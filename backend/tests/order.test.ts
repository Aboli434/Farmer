import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { signJwt } from '../src/utils/session';
import { Role, ProductType, OrderStatus, PaymentStatus } from '@prisma/client';
import { TestFactory } from './helpers/test-factory';

jest.setTimeout(30000);

let customer1Token: string;
let customer2Token: string;
let seller1Token: string;
let seller2Token: string;

let customer1Id: string;
let customer2Id: string;
let producer1Id: string;
let producer2Id: string;

let sellerOrder1Id: string;
let sellerOrder2Id: string;

beforeAll(async () => {
  // 1. Create Users
  const { user: customer1, session: c1Session } = await TestFactory.createCustomer();
  customer1Id = customer1.id;
  customer1Token = signJwt({ userId: customer1.id, sessionId: c1Session.id });

  const { user: customer2, session: c2Session } = await TestFactory.createCustomer();
  customer2Id = customer2.id;
  customer2Token = signJwt({ userId: customer2.id, sessionId: c2Session.id });

  const { user: seller1, session: s1Session, profile: profile1 } = await TestFactory.createSeller();
  producer1Id = profile1.id;
  seller1Token = signJwt({ userId: seller1.id, sessionId: s1Session.id });

  const { user: seller2, session: s2Session, profile: profile2 } = await TestFactory.createSeller();
  producer2Id = profile2.id;
  seller2Token = signJwt({ userId: seller2.id, sessionId: s2Session.id });

  // 2. Create Category, Product, Variant, Inventory
  const category = await TestFactory.createCategory('Dairy Orders');

  const { product: product1, variant: variant1, inventory: inventory1 } = await TestFactory.createProduct(profile1.id, category.id, {
    name: 'Ghee 1',
    quantity: 10,
    price: 500
  });
  
  // mock that 5 were sold in this order
  await prisma.inventory.update({
    where: { id: inventory1.id },
    data: { soldQuantity: 5 }
  });

  const { product: product2, variant: variant2, inventory: inventory2 } = await TestFactory.createProduct(profile2.id, category.id, {
    name: 'Ghee 2',
    quantity: 15,
    price: 800
  });

  // mock that 1 was sold in this order
  await prisma.inventory.update({
    where: { id: inventory2.id },
    data: { soldQuantity: 1 }
  });

  // 3. Seed a Mock Master Order representing a CONFIRMED state for customer1
  const masterOrder = await prisma.order.create({
    data: {
      userId: customer1.id,
      shippingAddressSnapshot: { address: 'Mock' },
      totalAmount: 1300
    }
  });

  await prisma.payment.create({
    data: {
      orderId: masterOrder.id,
      provider: 'RAZORPAY',
      amount: 1300,
      status: PaymentStatus.SUCCESS
    }
  });

  const so1 = await prisma.sellerOrder.create({
    data: {
      orderId: masterOrder.id,
      producerId: profile1.id,
      producerNameSnapshot: 'Farm 1',
      status: OrderStatus.CONFIRMED,
      subtotal: 500,
      totalAmount: 500
    }
  });
  sellerOrder1Id = so1.id;

  await prisma.orderItem.create({
    data: {
      sellerOrderId: so1.id,
      variantId: variant1.id,
      productNameSnapshot: 'Ghee 1',
      variantLabelSnapshot: '500ml',
      quantity: 1,
      unit: 'ml',
      unitPrice: 500,
      totalPrice: 500
    }
  });

  const so2 = await prisma.sellerOrder.create({
    data: {
      orderId: masterOrder.id,
      producerId: profile2.id,
      producerNameSnapshot: 'Farm 2',
      status: OrderStatus.CONFIRMED,
      subtotal: 800,
      totalAmount: 800
    }
  });
  sellerOrder2Id = so2.id;

  await prisma.orderItem.create({
    data: {
      sellerOrderId: so2.id,
      variantId: variant2.id,
      productNameSnapshot: 'Ghee 2',
      variantLabelSnapshot: '500ml',
      quantity: 1,
      unit: 'ml',
      unitPrice: 800,
      totalPrice: 800
    }
  });
});

afterAll(async () => {
  await TestFactory.cleanupTestData();
  await prisma.$disconnect();
});

describe('Phase 11 - Order Management + Fulfillment', () => {
  describe('Customer APIs', () => {
    it('should fetch own orders', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${customer1Token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].sellerOrders).toHaveLength(2);
    });

    it('should not allow fetching another customer order details', async () => {
      const order = await prisma.order.findFirst({ where: { userId: customer1Id } });
      const res = await request(app)
        .get(`/api/orders/${order!.id}`)
        .set('Authorization', `Bearer ${customer2Token}`);
      
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Order not found');
    });

    it('should allow customer to cancel a CONFIRMED order', async () => {
      const res = await request(app)
        .post(`/api/orders/mock-order/seller-orders/${sellerOrder1Id}/cancel`)
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(OrderStatus.CANCELLED);

      // Verify inventory RESTOCK
      const orderItem = await prisma.orderItem.findFirst({ where: { sellerOrderId: sellerOrder1Id } });
      const inv = await prisma.inventory.findUnique({ where: { variantId: orderItem!.variantId } });
      
      // Original was: available: 10, sold: 5. Cancelled 1 qty.
      // Now should be: available: 11, sold: 4
      expect(Number(inv!.availableQuantity)).toBe(11);
      expect(Number(inv!.soldQuantity)).toBe(4);

      // Verify Refund record creation
      const refund = await prisma.refund.findFirst({ where: { sellerOrderId: sellerOrder1Id } });
      expect(refund).not.toBeNull();
      expect(Number(refund!.amount)).toBe(500);

      // Verify payment partially refunded
      const payment = await prisma.payment.findFirst({ where: { id: refund!.paymentId } });
      expect(payment!.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    });
  });

  describe('Seller APIs', () => {
    it('should fetch own seller orders', async () => {
      const res = await request(app)
        .get('/api/seller/orders')
        .set('Authorization', `Bearer ${seller2Token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(sellerOrder2Id);
    });

    it('should prevent seller from fetching another seller order', async () => {
      const res = await request(app)
        .get(`/api/seller/orders/${sellerOrder1Id}`)
        .set('Authorization', `Bearer ${seller2Token}`);
      
      expect(res.status).toBe(404);
    });

    it('should allow seller to accept CONFIRMED order', async () => {
      const res = await request(app)
        .patch(`/api/seller/orders/${sellerOrder2Id}/status`)
        .set('Authorization', `Bearer ${seller2Token}`)
        .send({ status: OrderStatus.ACCEPTED });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(OrderStatus.ACCEPTED);
    });

    it('should prevent customer from cancelling an ACCEPTED order', async () => {
      const res = await request(app)
        .post(`/api/orders/mock-order/seller-orders/${sellerOrder2Id}/cancel`)
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Cannot cancel order/);
    });

    it('should safely reject invalid status transition', async () => {
      const res = await request(app)
        .patch(`/api/seller/orders/${sellerOrder2Id}/status`)
        .set('Authorization', `Bearer ${seller2Token}`)
        .send({ status: OrderStatus.DELIVERED }); // Missing PREPARING, READY, OUT_FOR_DELIVERY steps

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Cannot transition order/);
    });

    it('should complete valid fulfillment lifecycle', async () => {
      const steps = [
        OrderStatus.PREPARING,
        OrderStatus.READY,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED
      ];

      for (const step of steps) {
        const res = await request(app)
          .patch(`/api/seller/orders/${sellerOrder2Id}/status`)
          .set('Authorization', `Bearer ${seller2Token}`)
          .send({ status: step });
        
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(step);
      }
    });

    it('should properly handle Seller rejection of a CONFIRMED order', async () => {
      // 1. Create a brand new order for Seller 2 to test REJECTED state
      const masterOrder = await prisma.order.create({
        data: {
          userId: customer2Id,
          shippingAddressSnapshot: { address: 'Mock' },
          totalAmount: 400
        }
      });
      await prisma.payment.create({
        data: {
          orderId: masterOrder.id,
          provider: 'RAZORPAY',
          amount: 400,
          status: PaymentStatus.SUCCESS
        }
      });
      const soReject = await prisma.sellerOrder.create({
        data: {
          orderId: masterOrder.id,
          producerId: producer2Id,
          producerNameSnapshot: 'Farm 2',
          status: OrderStatus.CONFIRMED,
          subtotal: 400,
          totalAmount: 400
        }
      });
      
      const orderItem = await prisma.orderItem.create({
        data: {
          sellerOrderId: soReject.id,
          variantId: (await prisma.productVariant.findFirst({ where: { productId: { not: '' } } }))!.id,
          productNameSnapshot: 'Mock',
          variantLabelSnapshot: '1',
          quantity: 2,
          unit: 'pcs',
          unitPrice: 200,
          totalPrice: 400
        }
      });
      
      const invBefore = await prisma.inventory.findUnique({ where: { variantId: orderItem.variantId } });

      // 2. Reject it as Seller 2
      const res = await request(app)
        .patch(`/api/seller/orders/${soReject.id}/status`)
        .set('Authorization', `Bearer ${seller2Token}`)
        .send({ status: OrderStatus.REJECTED });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(OrderStatus.REJECTED);

      // 3. Verify RESTOCK logic
      const invAfter = await prisma.inventory.findUnique({ where: { variantId: orderItem.variantId } });
      expect(Number(invAfter!.availableQuantity)).toBe(Number(invBefore!.availableQuantity) + 2);
      expect(Number(invAfter!.soldQuantity)).toBe(Number(invBefore!.soldQuantity) - 2);

      // 4. Verify duplicate rejection fails safely
      const resDuplicate = await request(app)
        .patch(`/api/seller/orders/${soReject.id}/status`)
        .set('Authorization', `Bearer ${seller2Token}`)
        .send({ status: OrderStatus.REJECTED });
      
      expect(resDuplicate.status).toBe(400);
      expect(resDuplicate.body.error.message).toMatch(/Cannot transition order/);
    });
  });
});
