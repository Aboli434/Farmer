import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import crypto from 'crypto';
import { TestFactory } from '../helpers/test-factory';

describe('E2E: Webhook Idempotency', () => {
  let masterOrderId: string;

  beforeAll(async () => {
    const { user: c } = await TestFactory.createCustomer();
    const { user: s, profile } = await TestFactory.createSeller();
    const cat = await TestFactory.createCategory('Idempotent Veggies');
    const { variant } = await TestFactory.createProduct(profile.id, cat.id, { quantity: 10 });

    const { order } = await TestFactory.createTestOrder(c.id, s.id, variant.id, { quantity: 1, amount: 100 });
    masterOrderId = order.id;

    await prisma.payment.create({
      data: {
        orderId: masterOrderId,
        amount: 100,
        provider: 'RAZORPAY',
        providerOrderId: 'order_mock_idempotent',
        status: 'PENDING'
      }
    });
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('Processing duplicate payment.captured webhooks ignores the second attempt', async () => {
    const payload = { event: 'payment.captured', payload: { payment: { entity: { order_id: 'order_mock_idempotent' } } } };
    const secret = 'test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const bodyString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    // Send Webhook 1
    const res1 = await request(app).post('/api/webhooks/razorpay').set('x-razorpay-signature', signature).set('x-razorpay-event-id', 'evt_idem_1').set('Content-Type', 'application/json').send(bodyString);
    expect(res1.status).toBe(200);

    // State should be SUCCESS
    let payment = await prisma.payment.findFirst({ where: { providerOrderId: 'order_mock_idempotent' } });
    expect(payment?.status).toBe('SUCCESS');

    // Send Webhook 2 (EXACT SAME EVENT ID)
    const res2 = await request(app).post('/api/webhooks/razorpay').set('x-razorpay-signature', signature).set('x-razorpay-event-id', 'evt_idem_1').set('Content-Type', 'application/json').send(bodyString);
    expect(res2.status).toBe(200); // Server acknowledges it

    // Check that we only logged the event once
    const eventCount = await prisma.paymentWebhookEvent.count({ where: { providerEventId: 'evt_idem_1' } });
    expect(eventCount).toBe(1);

    // Verify it didn't crash or double-process logic
    payment = await prisma.payment.findFirst({ where: { providerOrderId: 'order_mock_idempotent' } });
    expect(payment?.status).toBe('SUCCESS');
  });
});
