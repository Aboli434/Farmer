import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import crypto from 'crypto';
import { TestFactory } from './helpers/test-factory';

describe('Phase 16 - Razorpay Webhooks', () => {
  let orderId: string;
  let paymentId: string;
  let providerOrderId: string;

  beforeAll(async () => {
    // We assume the isolated database is clean
    const { user, session } = await TestFactory.createCustomer();
    const address = await prisma.address.create({
      data: {
        userId: user.id,
        fullName: 'Test User',
        phone: '9999999999',
        pincode: '411001',
        city: 'Pune',
        district: 'Pune',
        state: 'MH',
        address: '123 Test St'
      }
    });

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        shippingAddressSnapshot: address as any,
        totalAmount: 1000
      }
    });
    orderId = order.id;

    providerOrderId = 'order_test123';
    
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'RAZORPAY',
        providerOrderId,
        amount: 1000,
        status: 'PENDING'
      }
    });
    paymentId = payment.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('should verify signature and process webhook successfully', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            order_id: providerOrderId,
            amount: 100000,
            status: 'captured'
          }
        }
      }
    };
    const bodyString = JSON.stringify(payload);
    
    // We mocked the secret via env in jest.setup.js or we will just use a dummy one
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;

    const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'event_1')
      .set('Content-Type', 'application/json')
      .send(bodyString); // raw body

    expect(res.status).toBe(200);

    // Verify DB State
    const updatedPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(updatedPayment?.status).toBe('SUCCESS');

    const event = await prisma.paymentWebhookEvent.findUnique({ where: { providerEventId: 'event_1' } });
    expect(event?.status).toBe('PROCESSED');
  });

  it('should block invalid signatures', async () => {
    const payload = { event: 'payment.captured' };
    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', 'invalid_signature')
      .set('x-razorpay-event-id', 'event_2')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(payload));

    expect(res.status).toBe(400);
  });

  it('should be idempotent (ignore duplicate event IDs)', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { order_id: providerOrderId }
        }
      }
    };
    const bodyString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', 'test_secret').update(bodyString).digest('hex');

    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'event_1') // duplicate ID
      .set('Content-Type', 'application/json')
      .send(bodyString);

    expect(res.status).toBe(200); // Should return 200 to acknowledge, but do nothing internally
    
    // The event count should still be 1 for 'event_1'
    const count = await prisma.paymentWebhookEvent.count({ where: { providerEventId: 'event_1' } });
    expect(count).toBe(1);
  });
});
