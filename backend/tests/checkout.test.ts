import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { signJwt } from '../src/utils/session';
import { Role, ProductType } from '@prisma/client';
import { TestFactory } from './helpers/test-factory';

jest.setTimeout(30000);

let mockOrderCounter = 0;
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockImplementation(() => {
        mockOrderCounter++;
        return Promise.resolve({ id: `order_mock_co_${mockOrderCounter}`, amount: 2000, status: 'created' });
      })
    }
  }));
});

let customerToken: string;
let customerId: string;
let addressId: string;
let product1Variant1Id: string;
let product2Variant1Id: string; // from another producer

beforeAll(async () => {
  // Create customer
  const { user: customer, session: customerSession, address } = await TestFactory.createCustomer();
  customerToken = signJwt({ userId: customer.id, sessionId: customerSession.id });
  customerId = customer.id;
  addressId = address.id;

  // Create a default category
  const category = await TestFactory.createCategory('Dairy Checkout');

  // Create Producer 1 & Product 1
  const { user: producer1User, profile: producer1 } = await TestFactory.createSeller();
  const { product: product1, variant: p1v1 } = await TestFactory.createProduct(producer1.id, category.id, { name: 'Organic Honey', quantity: 10, price: 500 });
  product1Variant1Id = p1v1.id;

  // Create Producer 2 & Product 2
  const { user: producer2User, profile: producer2 } = await TestFactory.createSeller();
  const { product: product2, variant: p2v1 } = await TestFactory.createProduct(producer2.id, category.id, { name: 'Organic Ghee', quantity: 5, price: 1000 });
  product2Variant1Id = p2v1.id;
});

afterAll(async () => {
  await TestFactory.cleanupTestData();
  await prisma.$disconnect();
});

describe('Phase 10 - Cart & Checkout', () => {

  describe('Cart Management', () => {
    it('should add item to cart', async () => {
      const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ variantId: product1Variant1Id, quantity: 2 }); // Honey

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.groupedByProducer).toHaveLength(1);
    });

    it('should add second item to cart (different producer)', async () => {
      const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ variantId: product2Variant1Id, quantity: 1 }); // Ghee

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.groupedByProducer).toHaveLength(2); // Multi-seller!
    });

    it('should prevent adding more than available stock', async () => {
      const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ variantId: product2Variant1Id, quantity: 10 }); // only 5 available

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/exceeds available stock/);
    });
  });

  describe('Checkout Initiation (Transactional)', () => {
    let mockPayment: any;
    let masterOrder: any;

    it('should fail with invalid address', async () => {
      const res = await request(app)
        .post('/api/checkout/initiate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          addressId: '00000000-0000-0000-0000-000000000000',
          idempotencyKey: 'key_fail_1'
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Address not found');
    });

    it('should initiate multi-seller checkout successfully', async () => {
      const res = await request(app)
        .post('/api/checkout/initiate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          addressId,
          idempotencyKey: 'key_success_1'
        });

      expect(res.status).toBe(200);
      
      const { payment } = res.body.data;
      expect(payment).toBeDefined();
      expect(payment.status).toBe('PENDING');
      
      mockPayment = payment;

      // Verify Master Order & Seller Orders were created
      masterOrder = await prisma.order.findUnique({
        where: { id: payment.orderId },
        include: { sellerOrders: { include: { items: true } } }
      });

      expect(masterOrder).toBeDefined();
      expect(masterOrder.sellerOrders).toHaveLength(2); // Multi-seller
      expect(Number(masterOrder.totalAmount)).toBe(2000); // 2*500 + 1*1000 = 2000

      // Verify Inventory Reservations were created implicitly
      const reservations = await prisma.inventoryReservation.findMany({
        where: { userId: customerId, status: 'RESERVED' }
      });
      expect(reservations).toHaveLength(2);

      // Verify Stock was decremented (moved to reserved)
      const inv1 = await prisma.inventory.findUnique({ where: { variantId: product1Variant1Id } });
      expect(Number(inv1?.availableQuantity)).toBe(8); // 10 - 2
      expect(Number(inv1?.reservedQuantity)).toBe(2);
    });

    it('should be idempotent on checkout initiation', async () => {
      const res = await request(app)
        .post('/api/checkout/initiate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          addressId,
          idempotencyKey: 'key_success_1' // Same key!
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(mockPayment.id); // Returns same payment
    });

    it('should handle mock webhook SUCCESS', async () => {
      // The providerOrderId used is whatever the mock returned for the first checkout
      const providerOrderId = `order_mock_co_1`;

      const payload = {
        event: 'payment.captured',
        payload: { payment: { entity: { order_id: providerOrderId } } }
      };
      
      const crypto = require('crypto');
      const secret = 'test_secret';
      process.env.RAZORPAY_WEBHOOK_SECRET = secret;
      const bodyString = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', 'evt_checkout_success')
        .set('Content-Type', 'application/json')
        .send(bodyString);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true); // Webhook returns { success: true }

      // Verify payment in DB
      const payment = await prisma.payment.findFirst({ where: { providerOrderId } });
      expect(payment?.status).toBe('SUCCESS');

      // Check Order Statuses
      const updatedOrder = await prisma.order.findUnique({
        where: { id: masterOrder.id },
        include: { sellerOrders: true }
      });
      expect(updatedOrder?.sellerOrders[0].status).toBe('CONFIRMED');

      // Check Inventory Reservations (Confirmed)
      const reservations = await prisma.inventoryReservation.findMany({
        where: { userId: customerId }
      });
      expect(reservations.every(r => r.status === 'CONFIRMED')).toBe(true);

      // Check Inventory final state (Moved to Sold)
      const inv1 = await prisma.inventory.findUnique({ where: { variantId: product1Variant1Id } });
      expect(Number(inv1?.reservedQuantity)).toBe(0);
      expect(Number(inv1?.soldQuantity)).toBe(2);

      // Cart should be cleared
      const cart = await prisma.cart.findFirst({
        where: { userId: customerId, status: 'ACTIVE' },
        include: { items: true }
      });
      expect(cart).toBeNull(); // OR status is COMPLETED
    });
  });

  describe('Checkout Failure Rollback', () => {
    it('should restore cart and release stock on payment failure', async () => {
      // Re-populate cart
      await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ variantId: product2Variant1Id, quantity: 1 }); // 1 Ghee (4 available now)

      // Initiate checkout
      const initRes = await request(app)
        .post('/api/checkout/initiate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ addressId, idempotencyKey: 'key_fail_test' });

      // mockOrderCounter will be 2 for this second checkout
      const failProviderOrderId = `order_mock_co_2`;
      expect(initRes.status).toBe(200);

      const payload = {
        event: 'payment.failed',
        payload: { payment: { entity: { order_id: failProviderOrderId } } }
      };
      
      const crypto = require('crypto');
      const secret = 'test_secret';
      process.env.RAZORPAY_WEBHOOK_SECRET = secret;
      const bodyString = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

      const webRes = await request(app)
        .post('/api/webhooks/razorpay')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', 'evt_checkout_fail')
        .set('Content-Type', 'application/json')
        .send(bodyString);

      expect(webRes.status).toBe(200);

      // Check SellerOrder cancelled — look up the order by providerOrderId from DB
      const failedPayment = await prisma.payment.findFirst({ where: { providerOrderId: failProviderOrderId } });
      const masterOrder = await prisma.order.findUnique({
        where: { id: failedPayment!.orderId },
        include: { sellerOrders: true }
      });
      expect(masterOrder?.sellerOrders[0].status).toBe('CANCELLED');

      // Stock should be back in available
      const inv2 = await prisma.inventory.findUnique({ where: { variantId: product2Variant1Id } });
      expect(Number(inv2?.reservedQuantity)).toBe(0);
      expect(Number(inv2?.availableQuantity)).toBe(4); // 5 - 1 sold earlier = 4

      // Cart should STILL exist and be active
      const cart = await prisma.cart.findFirst({
        where: { userId: customerId, status: 'ACTIVE' },
        include: { items: true }
      });
      expect(cart).not.toBeNull();
      expect(cart?.items).toHaveLength(1);
    });
  });

});
