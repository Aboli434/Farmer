import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { TestFactory } from '../helpers/test-factory';
import { signJwt } from '../../src/utils/session';
import crypto from 'crypto';

let mockIdCounter = 0;
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockImplementation(() => {
        mockIdCounter++;
        return Promise.resolve({ id: `rzp_ai_${mockIdCounter}`, amount: 10000, status: 'created' });
      })
    },
    payments: {
      refund: jest.fn().mockResolvedValue({ id: 'rfnd_ai_1', status: 'processed' })
    }
  }));
});

describe('E2E: Admin Intervention (Force Cancel)', () => {
  let customerToken: string;
  let adminToken: string;
  let adminId: string;
  let addressId: string;
  let variantId: string;
  let masterOrderId: string;
  let sellerOrderId: string;

  beforeAll(async () => {
    const { user: c, session: sc, address } = await TestFactory.createCustomer();
    customerToken = signJwt({ userId: c.id, sessionId: sc.id });
    addressId = address.id;

    const { user: a, session: sa } = await TestFactory.createAdmin();
    adminId = a.id;
    adminToken = signJwt({ userId: a.id, sessionId: sa.id });

    const { profile } = await TestFactory.createSeller();
    const cat = await TestFactory.createCategory('Admin Veggies');
    const { variant } = await TestFactory.createProduct(profile.id, cat.id, { quantity: 10 });
    variantId = variant.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('Admin force cancels a paid order → Refunds, Restocks, and Audit Log', async () => {
    // 1. Customer adds to cart and checks out
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId, quantity: 1 });

    const checkoutRes = await request(app)
      .post('/api/checkout/initiate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ addressId, idempotencyKey: `ai_key_${Date.now()}` });

    expect(checkoutRes.status).toBe(200);
    masterOrderId = checkoutRes.body.data.payment.orderId;
    const providerOrderId = checkoutRes.body.data.providerOrderId;

    // 2. Customer pays (webhook)
    const payload = { event: 'payment.captured', payload: { payment: { entity: { order_id: providerOrderId } } } };
    const secret = 'test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const bodyString = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    await request(app).post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', sig)
      .set('x-razorpay-event-id', `evt_ai_${Date.now()}`)
      .set('Content-Type', 'application/json')
      .send(bodyString);

    const orders = await prisma.sellerOrder.findMany({ where: { orderId: masterOrderId } });
    expect(orders.length).toBe(1);
    sellerOrderId = orders[0].id;

    // 3. Admin Force Cancels
    const res = await request(app)
      .post(`/api/admin/orders/${sellerOrderId}/force-cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Test emergency cancellation' });

    expect(res.status).toBe(200);

    // 4. Verify Order CANCELLED
    const order = await prisma.sellerOrder.findUnique({ where: { id: sellerOrderId } });
    expect(order?.status).toBe('CANCELLED');

    // 5. Verify Refund created
    const refunds = await prisma.refund.findMany({ where: { sellerOrderId } });
    expect(refunds.length).toBe(1);

    // 6. Verify Inventory Restocked
    const inv = await prisma.inventory.findUnique({ where: { variantId } });
    expect(Number(inv?.availableQuantity)).toBe(10);
    expect(Number(inv?.soldQuantity)).toBe(0);

    // 7. Verify immutable Audit Log entry
    const logs = await prisma.adminAction.findMany({
      where: { entityId: sellerOrderId, adminId }
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});
