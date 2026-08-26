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
        return Promise.resolve({ id: `rzp_ms_${mockIdCounter}`, amount: 20000, status: 'created' });
      })
    },
    payments: {
      refund: jest.fn().mockResolvedValue({ id: 'rfnd_ms_1', status: 'processed' })
    }
  }));
});

describe('E2E: Multi-Seller Isolation & Partial Rejection', () => {
  let customerToken: string;
  let customerId: string;
  let sellerAToken: string;
  let sellerBToken: string;
  let sellerAId: string;
  let sellerBId: string;
  let variantAId: string;
  let variantBId: string;
  let sellerOrderIdA: string;
  let sellerOrderIdB: string;

  beforeAll(async () => {
    const { user: c, session: sc, address } = await TestFactory.createCustomer();
    customerId = c.id;
    customerToken = signJwt({ userId: c.id, sessionId: sc.id });

    const { user: sA, session: ssA, profile: pA } = await TestFactory.createSeller();
    sellerAToken = signJwt({ userId: sA.id, sessionId: ssA.id });
    sellerAId = pA.id;

    const { user: sB, session: ssB, profile: pB } = await TestFactory.createSeller();
    sellerBToken = signJwt({ userId: sB.id, sessionId: ssB.id });
    sellerBId = pB.id;

    const cat = await TestFactory.createCategory('MS Veggies');
    const { variant: varA } = await TestFactory.createProduct(pA.id, cat.id, { quantity: 10 });
    variantAId = varA.id;
    const { variant: varB } = await TestFactory.createProduct(pB.id, cat.id, { quantity: 10 });
    variantBId = varB.id;

    // Add both items to cart
    const addressId = address.id;
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${customerToken}`).send({ variantId: variantAId, quantity: 1 });
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${customerToken}`).send({ variantId: variantBId, quantity: 1 });

    // Checkout
    const checkoutRes = await request(app)
      .post('/api/checkout/initiate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ addressId, idempotencyKey: `ms_key_${Date.now()}` });

    expect(checkoutRes.status).toBe(200);
    const masterOrderId = checkoutRes.body.data.payment.orderId;
    const providerOrderId = checkoutRes.body.data.providerOrderId;

    // Pay via webhook
    const payload = { event: 'payment.captured', payload: { payment: { entity: { order_id: providerOrderId } } } };
    const secret = 'test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const bodyString = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
    await request(app).post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', sig)
      .set('x-razorpay-event-id', `evt_ms_${Date.now()}`)
      .set('Content-Type', 'application/json')
      .send(bodyString);

    // Identify which seller order belongs to whom
    const sellerOrders = await prisma.sellerOrder.findMany({ where: { orderId: masterOrderId } });
    expect(sellerOrders.length).toBe(2);
    const soA = sellerOrders.find(o => o.producerId === sellerAId);
    const soB = sellerOrders.find(o => o.producerId === sellerBId);
    sellerOrderIdA = soA!.id;
    sellerOrderIdB = soB!.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('Seller A ACCEPTED is completely unaffected when Seller B REJECTS', async () => {
    // Seller A accepts
    const resA = await request(app)
      .patch(`/api/seller/orders/${sellerOrderIdA}/status`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ status: 'ACCEPTED' });
    expect(resA.status).toBe(200);

    // Seller B rejects
    const resB = await request(app)
      .patch(`/api/seller/orders/${sellerOrderIdB}/status`)
      .set('Authorization', `Bearer ${sellerBToken}`)
      .send({ status: 'REJECTED', cancellationReason: 'Out of capacity' });
    expect(resB.status).toBe(200);

    // Verify Isolation: A is ACCEPTED, B is REJECTED
    const orderA = await prisma.sellerOrder.findUnique({ where: { id: sellerOrderIdA } });
    expect(orderA?.status).toBe('ACCEPTED');

    const orderB = await prisma.sellerOrder.findUnique({ where: { id: sellerOrderIdB } });
    expect(orderB?.status).toBe('REJECTED');

    // Verify refund created for B only
    const refunds = await prisma.refund.findMany({ where: { sellerOrderId: sellerOrderIdB } });
    expect(refunds.length).toBe(1);

    // Verify no refund for A
    const refundsA = await prisma.refund.findMany({ where: { sellerOrderId: sellerOrderIdA } });
    expect(refundsA.length).toBe(0);

    // Verify inventory: A sold=1, B restocked=10
    const invA = await prisma.inventory.findUnique({ where: { variantId: variantAId } });
    const invB = await prisma.inventory.findUnique({ where: { variantId: variantBId } });
    expect(Number(invA?.soldQuantity)).toBe(1);
    expect(Number(invB?.availableQuantity)).toBe(10); // Restocked
    expect(Number(invB?.soldQuantity)).toBe(0);
  });
});
