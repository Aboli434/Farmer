import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { TestFactory } from '../helpers/test-factory';
import { signJwt } from '../../src/utils/session';
import crypto from 'crypto';

// Counter for unique Razorpay order IDs per test run
let mockIdCounter = 0;
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockImplementation(() => {
        mockIdCounter++;
        return Promise.resolve({ id: `rzp_hp_${mockIdCounter}`, amount: 10000, status: 'created' });
      })
    },
    payments: {
      refund: jest.fn().mockResolvedValue({ id: 'rfnd_hp_1', status: 'processed' })
    }
  }));
});

describe('E2E: Happy Path - Complete Marketplace Lifecycle', () => {
  let customerToken: string;
  let customerId: string;
  let sellerToken: string;
  let addressId: string;
  let variantId: string;
  let masterOrderId: string;
  let sellerOrderId: string;
  let providerOrderId: string;

  beforeAll(async () => {
    const { user: customer, session: cSession, address } = await TestFactory.createCustomer();
    customerId = customer.id;
    customerToken = signJwt({ userId: customer.id, sessionId: cSession.id });
    addressId = address.id;

    const { user: seller, session: sSession, profile } = await TestFactory.createSeller();
    sellerToken = signJwt({ userId: seller.id, sessionId: sSession.id });

    const cat = await TestFactory.createCategory('HP Veggies');
    const { variant } = await TestFactory.createProduct(profile.id, cat.id, { quantity: 50 });
    variantId = variant.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('1. Customer adds product to cart and checks out (Inventory RESERVED)', async () => {
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId, quantity: 2 });

    const checkoutRes = await request(app)
      .post('/api/checkout/initiate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ addressId, idempotencyKey: `hp_key_${Date.now()}` });

    if (checkoutRes.status !== 200) console.error('Checkout Failed:', checkoutRes.body);
    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.data.payment).toBeDefined();

    masterOrderId = checkoutRes.body.data.payment.orderId;
    providerOrderId = checkoutRes.body.data.providerOrderId;

    const inv = await prisma.inventory.findUnique({ where: { variantId } });
    expect(Number(inv?.availableQuantity)).toBe(48);
    expect(Number(inv?.reservedQuantity)).toBe(2);
  });

  it('2. Razorpay Webhook converts reservation to SALE and order to CONFIRMED', async () => {
    const payload = {
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: providerOrderId } } }
    };
    const secret = 'test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const bodyString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    const webhookRes = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', `evt_hp_${Date.now()}`)
      .set('Content-Type', 'application/json')
      .send(bodyString);

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.success).toBe(true);

    const payment = await prisma.payment.findFirst({ where: { orderId: masterOrderId } });
    expect(payment?.status).toBe('SUCCESS');

    const sellerOrders = await prisma.sellerOrder.findMany({ where: { orderId: masterOrderId } });
    expect(sellerOrders[0].status).toBe('CONFIRMED');
    sellerOrderId = sellerOrders[0].id;

    const inv = await prisma.inventory.findUnique({ where: { variantId } });
    expect(Number(inv?.reservedQuantity)).toBe(0);
    expect(Number(inv?.soldQuantity)).toBe(2);
  });

  it('3. Fulfillment Lifecycle: ACCEPTED → DELIVERED', async () => {
    for (const status of ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
      const res = await request(app)
        .patch(`/api/seller/orders/${sellerOrderId}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status });
      expect(res.status).toBe(200);
    }

    const order = await prisma.sellerOrder.findUnique({ where: { id: sellerOrderId } });
    expect(order?.status).toBe('DELIVERED');
  });

  it('4. Customer Reviews the Delivered Product', async () => {
    const orderItem = await prisma.orderItem.findFirst({ where: { sellerOrderId } });

    const reviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderItemId: orderItem!.id, rating: 5, comment: 'Excellent produce!' });

    expect(reviewRes.status).toBe(201);
    expect(reviewRes.body.data.rating).toBe(5);
  });
});
