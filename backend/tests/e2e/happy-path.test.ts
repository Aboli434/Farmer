import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { TestFactory } from '../helpers/test-factory';
import { signJwt } from '../../src/utils/session';
import crypto from 'crypto';

// Mock Razorpay globally for this suite
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'order_mock_123', amount: 1000, status: 'created' })
    },
    payments: {
      refund: jest.fn().mockResolvedValue({ id: 'rfnd_mock_123', status: 'processed' })
    }
  }));
});

describe('E2E: Happy Path - Complete Marketplace Lifecycle', () => {
  let customerToken: string;
  let sellerToken: string;
  let customerId: string;
  let sellerId: string;
  let profileId: string;
  let variantId: string;
  let masterOrderId: string;
  let sellerOrderId: string;
  let paymentId: string;

  beforeAll(async () => {
    // 1. Setup Actors
    const { user: customer, session: cSession } = await TestFactory.createCustomer();
    customerId = customer.id;
    customerToken = signJwt({ userId: customer.id, sessionId: cSession.id });

    const { user: seller, session: sSession, profile } = await TestFactory.createSeller();
    sellerId = seller.id;
    profileId = profile.id;
    sellerToken = signJwt({ userId: seller.id, sessionId: sSession.id });

    // Customer Address
    await prisma.address.create({
      data: {
        userId: customer.id, fullName: 'Cust', phone: '9999', pincode: '411001', city: 'Pune', district: 'Pune', state: 'MH', address: '123'
      }
    });

    // 2. Setup Catalog & Inventory
    const cat = await TestFactory.createCategory('Fresh Veggies');
    const { product, variant, inventory } = await TestFactory.createProduct(profile.id, cat.id, { quantity: 50 });
    variantId = variant.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('1. Customer adds product to cart and checks out (Inventory RESERVED)', async () => {
    // Add to cart
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId, quantity: 2 });
    
    // Checkout
    const checkoutRes = await request(app)
      .post('/api/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ paymentMethod: 'RAZORPAY' });

    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.data.orderId).toBeDefined();
    
    masterOrderId = checkoutRes.body.data.orderId;
    
    // Verify Payment was created in PENDING state
    const payment = await prisma.payment.findFirst({ where: { orderId: masterOrderId } });
    expect(payment).toBeDefined();
    expect(payment?.status).toBe('PENDING');
    paymentId = payment!.id;

    // Verify Inventory is Reserved (50 available -> 48 available, 2 reserved)
    const inv = await prisma.inventory.findUnique({ where: { variantId } });
    expect(Number(inv?.availableQuantity)).toBe(48);
    expect(Number(inv?.reservedQuantity)).toBe(2);
  });

  it('2. Razorpay Webhook converts reservation to SALE and order to CONFIRMED', async () => {
    // Simulate Razorpay webhook
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: { entity: { order_id: 'order_mock_123' } } // the mocked providerOrderId
      }
    };
    
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const bodyString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    const webhookRes = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'evt_happy_123')
      .set('Content-Type', 'application/json')
      .send(bodyString);
    
    expect(webhookRes.status).toBe(200);

    // Verify Order and Payment
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe('SUCCESS');

    const sellerOrders = await prisma.sellerOrder.findMany({ where: { orderId: masterOrderId } });
    expect(sellerOrders.length).toBe(1);
    expect(sellerOrders[0].status).toBe('CONFIRMED');
    sellerOrderId = sellerOrders[0].id;

    // Verify Inventory SALE
    const inv = await prisma.inventory.findUnique({ where: { variantId } });
    expect(Number(inv?.reservedQuantity)).toBe(0); // Reservation resolved
    expect(Number(inv?.soldQuantity)).toBe(2);
  });

  it('3. Fulfillment Lifecycle (Seller Accepts -> Delivered)', async () => {
    // Accept
    let res = await request(app).post(`/api/seller/orders/${sellerOrderId}/status`).set('Authorization', `Bearer ${sellerToken}`).send({ status: 'ACCEPTED' });
    expect(res.status).toBe(200);

    // Preparing
    res = await request(app).post(`/api/seller/orders/${sellerOrderId}/status`).set('Authorization', `Bearer ${sellerToken}`).send({ status: 'PREPARING' });
    expect(res.status).toBe(200);

    // Ready
    res = await request(app).post(`/api/seller/orders/${sellerOrderId}/status`).set('Authorization', `Bearer ${sellerToken}`).send({ status: 'READY' });
    expect(res.status).toBe(200);

    // Out for delivery
    res = await request(app).post(`/api/seller/orders/${sellerOrderId}/status`).set('Authorization', `Bearer ${sellerToken}`).send({ status: 'OUT_FOR_DELIVERY' });
    expect(res.status).toBe(200);

    // Delivered
    res = await request(app).post(`/api/seller/orders/${sellerOrderId}/status`).set('Authorization', `Bearer ${sellerToken}`).send({ status: 'DELIVERED' });
    expect(res.status).toBe(200);

    const order = await prisma.sellerOrder.findUnique({ where: { id: sellerOrderId } });
    expect(order?.status).toBe('DELIVERED');
  });

  it('4. Customer Reviews the Delivered Product', async () => {
    const orderItem = await prisma.orderItem.findFirst({ where: { sellerOrderId } });
    
    const reviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderItemId: orderItem!.id, rating: 5, comment: 'Excellent' });
    
    expect(reviewRes.status).toBe(201);
    expect(reviewRes.body.data.rating).toBe(5);
  });
});
