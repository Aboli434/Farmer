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
        return Promise.resolve({ id: `rzp_pf_${mockIdCounter}`, amount: 10000, status: 'created' });
      })
    }
  }));
});

describe('E2E: Payment Failure Handling', () => {
  let customerToken: string;
  let customerId: string;
  let addressId: string;
  let variantId: string;

  beforeAll(async () => {
    const { user: c, session: s, address } = await TestFactory.createCustomer();
    customerId = c.id;
    customerToken = signJwt({ userId: c.id, sessionId: s.id });
    addressId = address.id;

    const { profile } = await TestFactory.createSeller();
    const cat = await TestFactory.createCategory('PF Veggies');
    const { variant } = await TestFactory.createProduct(profile.id, cat.id, { quantity: 10 });
    variantId = variant.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('Payment failure automatically releases inventory reservation and preserves cart', async () => {
    // 1. Add to cart
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId, quantity: 2 });

    // 2. Initiate checkout
    const checkoutRes = await request(app)
      .post('/api/checkout/initiate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ addressId, idempotencyKey: `pf_key_${Date.now()}` });

    expect(checkoutRes.status).toBe(200);
    const providerOrderId = checkoutRes.body.data.providerOrderId;
    const masterOrderId = checkoutRes.body.data.payment.orderId;

    // Verify reserved
    let inv = await prisma.inventory.findUnique({ where: { variantId } });
    expect(Number(inv?.reservedQuantity)).toBe(2);

    // 3. Trigger payment.failed webhook
    const payload = {
      event: 'payment.failed',
      payload: { payment: { entity: { order_id: providerOrderId } } }
    };
    const secret = 'test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const bodyString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    const webhookRes = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', `evt_pf_${Date.now()}`)
      .set('Content-Type', 'application/json')
      .send(bodyString);

    expect(webhookRes.status).toBe(200);

    // 4. Verify Payment FAILED
    const payment = await prisma.payment.findFirst({ where: { orderId: masterOrderId } });
    expect(payment?.status).toBe('FAILED');

    // 5. Verify SellerOrders CANCELLED
    const sellerOrders = await prisma.sellerOrder.findMany({ where: { orderId: masterOrderId } });
    expect(sellerOrders.every(o => o.status === 'CANCELLED')).toBe(true);

    // 6. Verify Inventory RESTOCKED
    inv = await prisma.inventory.findUnique({ where: { variantId } });
    expect(Number(inv?.reservedQuantity)).toBe(0);
    expect(Number(inv?.availableQuantity)).toBe(10);

    // 7. Cart preserved (still ACTIVE with items)
    const cart = await prisma.cart.findFirst({
      where: { userId: customerId, status: 'ACTIVE' },
      include: { items: true }
    });
    expect(cart).not.toBeNull();
    expect(cart!.items.length).toBeGreaterThanOrEqual(1);
  });
});
