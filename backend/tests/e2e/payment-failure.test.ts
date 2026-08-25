import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import crypto from 'crypto';
import { TestFactory } from '../helpers/test-factory';
import { signJwt } from '../../src/utils/session';

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'order_mock_fail', amount: 1000, status: 'created' })
    }
  }));
});

describe('E2E: Payment Failure Handling', () => {
  let customerToken: string;
  let variantId: string;
  let masterOrderId: string;

  beforeAll(async () => {
    const { user: c, session: s } = await TestFactory.createCustomer();
    customerToken = signJwt({ userId: c.id, sessionId: s.id });
    await prisma.address.create({ data: { userId: c.id, fullName: 'C', phone: '1', pincode: '411', city: 'A', district: 'A', state: 'A', address: 'A' }});

    const { user: seller, profile } = await TestFactory.createSeller();
    const cat = await TestFactory.createCategory('Fail Veggies');
    const { variant } = await TestFactory.createProduct(profile.id, cat.id, { quantity: 10 });
    variantId = variant.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('Payment failure automatically releases inventory reservation', async () => {
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${customerToken}`).send({ variantId, quantity: 2 });
    const checkoutRes = await request(app).post('/api/checkout').set('Authorization', `Bearer ${customerToken}`).send({ paymentMethod: 'RAZORPAY' });
    masterOrderId = checkoutRes.body.data.orderId;

    // Verify reserved
    let inv = await prisma.inventory.findUnique({ where: { variantId } });
    expect(Number(inv?.reservedQuantity)).toBe(2);

    // Trigger payment.failed webhook
    const payload = { event: 'payment.failed', payload: { payment: { entity: { order_id: 'order_mock_fail' } } } };
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const bodyString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    const webhookRes = await request(app).post('/api/webhooks/razorpay').set('x-razorpay-signature', signature).set('x-razorpay-event-id', 'evt_fail_123').set('Content-Type', 'application/json').send(bodyString);
    expect(webhookRes.status).toBe(200);

    // Verify Payment FAILED
    const payment = await prisma.payment.findFirst({ where: { orderId: masterOrderId } });
    expect(payment?.status).toBe('FAILED');

    // Verify Order CANCELLED
    const sellerOrders = await prisma.sellerOrder.findMany({ where: { orderId: masterOrderId } });
    expect(sellerOrders[0].status).toBe('CANCELLED');

    // Verify Inventory RESTOCKED (Reservation Released)
    inv = await prisma.inventory.findUnique({ where: { variantId } });
    expect(Number(inv?.reservedQuantity)).toBe(0);
    expect(Number(inv?.availableQuantity)).toBe(10); // Back to original

    // Verify Cart is preserved
    const cart = await prisma.cart.findFirst({ where: { userId: customerToken ? signJwt.mock?.calls?.[0] : undefined }, include: { items: true } /* Hacky */ });
    // Assuming cart is ACTIVE since the payment failed
    const c = await prisma.cart.findFirst({ where: { items: { some: { variantId } } }, include: { items: true } });
    expect(c?.status).toBe('ACTIVE');
    expect(c?.items.length).toBe(1);
  });
});
