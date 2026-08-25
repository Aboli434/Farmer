import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { TestFactory } from '../helpers/test-factory';
import { signJwt } from '../../src/utils/session';
import crypto from 'crypto';

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'order_mock_admin', amount: 1000, status: 'created' })
    },
    payments: {
      refund: jest.fn().mockResolvedValue({ id: 'rfnd_mock_admin', status: 'processed' })
    }
  }));
});

describe('E2E: Admin Intervention (Force Cancel)', () => {
  let customerToken: string;
  let adminToken: string;
  let variantId: string;
  let masterOrderId: string;
  let sellerOrderId: string;
  let paymentId: string;

  beforeAll(async () => {
    const { user: c, session: sc } = await TestFactory.createCustomer();
    customerToken = signJwt({ userId: c.id, sessionId: sc.id });
    await prisma.address.create({ data: { userId: c.id, fullName: 'C', phone: '1', pincode: '411', city: 'A', district: 'A', state: 'A', address: 'A' }});

    const { user: s, profile } = await TestFactory.createSeller();
    const cat = await TestFactory.createCategory('Admin Veggies');
    const { variant } = await TestFactory.createProduct(profile.id, cat.id, { quantity: 10 });
    variantId = variant.id;

    const { user: a, session: sa } = await TestFactory.createAdmin();
    adminToken = signJwt({ userId: a.id, sessionId: sa.id });
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('Admin force cancels a paid order -> Refunds and Restocks', async () => {
    // 1. Customer buys
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${customerToken}`).send({ variantId, quantity: 1 });
    const checkoutRes = await request(app).post('/api/checkout').set('Authorization', `Bearer ${customerToken}`).send({ paymentMethod: 'RAZORPAY' });
    masterOrderId = checkoutRes.body.data.orderId;

    // 2. Customer pays
    const payload = { event: 'payment.captured', payload: { payment: { entity: { order_id: 'order_mock_admin' } } } };
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const bodyString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
    await request(app).post('/api/webhooks/razorpay').set('x-razorpay-signature', signature).set('x-razorpay-event-id', 'evt_admin_1').set('Content-Type', 'application/json').send(bodyString);

    const orders = await prisma.sellerOrder.findMany({ where: { orderId: masterOrderId } });
    sellerOrderId = orders[0].id;
    const payment = await prisma.payment.findFirst({ where: { orderId: masterOrderId } });
    paymentId = payment!.id;

    // 3. Admin Force Cancels
    const res = await request(app)
      .post(`/api/admin/orders/${sellerOrderId}/force-cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Emergency' });
    
    expect(res.status).toBe(200);

    // Verify Order is CANCELLED
    const o = await prisma.sellerOrder.findUnique({ where: { id: sellerOrderId } });
    expect(o?.status).toBe('CANCELLED');

    // Verify Refund
    const refunds = await prisma.refund.findMany({ where: { sellerOrderId } });
    expect(refunds.length).toBe(1);
    expect(refunds[0].status).toBe('PROCESSED'); // Since mock returns processed

    // Verify Inventory Restock (10 -> 1 reserved -> 1 sold -> 10 available)
    const inv = await prisma.inventory.findUnique({ where: { variantId } });
    expect(Number(inv?.availableQuantity)).toBe(10);
    expect(Number(inv?.soldQuantity)).toBe(0);

    // Verify Audit Log
    const logs = await prisma.adminAction.findMany({ where: { entityId: sellerOrderId, action: 'REFUND_ORDER' } });
    expect(logs.length).toBe(1);
  });
});
