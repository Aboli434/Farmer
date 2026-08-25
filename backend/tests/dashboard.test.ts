import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { OrderStatus, RefundStatus, ProductStatus, PaymentStatus, ReviewStatus } from '@prisma/client';
import { signJwt } from '../src/utils/session';
import { TestFactory } from './helpers/test-factory';

describe('Phase 14 - Producer Dashboard', () => {
  jest.setTimeout(60000);

  let sellerToken: string;
  let sellerId: string;
  let producerId: string;

  let newSellerToken: string;
  let newSellerId: string;
  
  let customerToken: string;
  let customerId: string;

  beforeAll(async () => {
    // 1. Seller with Data
    const s = await TestFactory.createSeller();
    sellerId = s.user.id;
    producerId = s.profile.id;
    sellerToken = `token=${signJwt({ userId: s.user.id, sessionId: s.session.id })}; Path=/; HttpOnly`;

    // 2. New Empty Seller
    const ns = await TestFactory.createSeller();
    newSellerId = ns.user.id;
    newSellerToken = `token=${signJwt({ userId: ns.user.id, sessionId: ns.session.id })}; Path=/; HttpOnly`;

    // 3. Customer (No dashboard access)
    const c = await TestFactory.createCustomer({ name: 'Dash Customer' });
    customerId = c.user.id;
    customerToken = `token=${signJwt({ userId: c.user.id, sessionId: c.session.id })}; Path=/; HttpOnly`;

    // Set up Products & Inventory for Seller 1
    const cat = await TestFactory.createCategory('Dash Category');
    
    // Product 1 (Active, Low Stock: threshold=5, qty=2)
    const prod1 = await TestFactory.createProduct(producerId, cat.id, { name: 'P1', quantity: 2, price: 100 });
    await prisma.inventory.update({ where: { variantId: prod1.variant.id }, data: { lowStockThreshold: 5 } });

    // Product 2 (Active, Out of Stock: threshold=5, qty=0)
    const prod2 = await TestFactory.createProduct(producerId, cat.id, { name: 'P2', quantity: 0, price: 200 });
    await prisma.inventory.update({ where: { variantId: prod2.variant.id }, data: { lowStockThreshold: 5 } });

    // Product 3 (Pending, Healthy Stock: threshold=5, qty=10)
    const prod3 = await TestFactory.createProduct(producerId, cat.id, { name: 'P3', quantity: 10, price: 300 });
    await prisma.product.update({ where: { id: prod3.product.id }, data: { status: ProductStatus.PENDING } });
    await prisma.inventory.update({ where: { variantId: prod3.variant.id }, data: { lowStockThreshold: 5 } });

    // Product 4 (Active, Out of Stock but 0 threshold, still OOS)
    const prod4 = await TestFactory.createProduct(producerId, cat.id, { name: 'P4', quantity: 0, price: 400 });

    // Set up Orders for Seller 1
    // Order 1: DELIVERED (Revenue: 100)
    const o1 = await TestFactory.createTestOrder(customerId, sellerId, prod1.variant.id);
    await prisma.sellerOrder.update({ where: { id: o1.sellerOrder.id }, data: { status: OrderStatus.DELIVERED } });
    
    // Order 2: CONFIRMED (Revenue: 0, pending)
    const o2 = await TestFactory.createTestOrder(customerId, sellerId, prod1.variant.id);
    // o2 is CONFIRMED by default

    // Order 3: DELIVERED with partial refund (Revenue: 100 - 50 = 50)
    const o3 = await TestFactory.createTestOrder(customerId, sellerId, prod1.variant.id);
    await prisma.sellerOrder.update({ where: { id: o3.sellerOrder.id }, data: { status: OrderStatus.DELIVERED } });
    
    // Create Mock Payment
    const payment = await prisma.payment.create({
      data: {
        orderId: o3.order.id,
        amount: 100,
        providerOrderId: `MOCK_ORDER_${Date.now()}`,
        provider: 'STRIPE',
        status: PaymentStatus.SUCCESS,
        providerPaymentId: `MOCK_PAY_${Date.now()}`,
        idempotencyKey: `MOCK_IDEMP_${Date.now()}`
      }
    });

    await prisma.refund.create({
      data: {
        paymentId: payment.id,
        sellerOrderId: o3.sellerOrder.id,
        amount: 50,
        reason: 'Damaged item',
        status: RefundStatus.PROCESSED,
        providerRefundId: `MOCK_REF_${Date.now()}`
      }
    });

    // Order 4: CANCELLED (Revenue: 0)
    const o4 = await TestFactory.createTestOrder(customerId, sellerId, prod1.variant.id);
    await prisma.sellerOrder.update({ where: { id: o4.sellerOrder.id }, data: { status: OrderStatus.CANCELLED } });

    // Create Old Order (> 30 days ago) DELIVERED (Revenue: 1000, should be excluded from 30d)
    const oOld = await TestFactory.createTestOrder(customerId, sellerId, prod1.variant.id, { amount: 1000 });
    await prisma.sellerOrder.update({ 
      where: { id: oOld.sellerOrder.id }, 
      data: { 
        status: OrderStatus.DELIVERED,
        createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        totalAmount: 1000,
        subtotal: 1000
      } 
    });

    // Fix inventory fallback to 100 for prod2 and prod4
    await prisma.inventory.update({ where: { variantId: prod2.variant.id }, data: { availableQuantity: 0 } });
    await prisma.inventory.update({ where: { variantId: prod4.variant.id }, data: { availableQuantity: 0 } });

    // Setup Reviews
    const oi1 = await prisma.orderItem.findFirst({ where: { sellerOrderId: o1.sellerOrder.id } });
    await prisma.review.create({
      data: {
        userId: customerId,
        productId: prod1.product.id,
        orderItemId: oi1!.id,
        rating: 4,
        comment: 'Nice',
        status: ReviewStatus.VISIBLE
      }
    });

    const oi3 = await prisma.orderItem.findFirst({ where: { sellerOrderId: o3.sellerOrder.id } });
    await prisma.review.create({
      data: {
        userId: customerId,
        productId: prod1.product.id,
        orderItemId: oi3!.id,
        rating: 2,
        comment: 'Bad',
        status: ReviewStatus.HIDDEN // Should not affect aggregate
      }
    });
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { userId: customerId } });
    await TestFactory.cleanupTestData();
  });

  describe('Authorization and Access', () => {
    it('should deny access to CUSTOMER', async () => {
      const res = await request(app).get('/api/seller/dashboard/summary').set('Cookie', customerToken);
      expect(res.status).toBe(403);
    });

    it('should deny access without auth', async () => {
      const res = await request(app).get('/api/seller/dashboard/summary');
      expect(res.status).toBe(401);
    });
  });

  describe('Dashboard Metrics & Aggregation', () => {
    it('should return correct defaults for an empty seller', async () => {
      const res = await request(app).get('/api/seller/dashboard/summary').set('Cookie', newSellerToken);
      expect(res.status).toBe(200);
      
      const { data } = res.body;
      expect(data.sales.revenue).toBe("0.00");
      expect(data.sales.successfulOrders).toBe(0);
      expect(data.orders.delivered).toBe(0);
      expect(data.products.active).toBe(0);
      expect(data.inventory.lowStockCount).toBe(0);
      expect(data.inventory.outOfStockCount).toBe(0);
      expect(data.trust.averageRating).toBe(0);
      expect(data.recentOrders.length).toBe(0);
    });

    it('should calculate revenue (Delivered only, net of refunds, 30 days window)', async () => {
      const res = await request(app).get('/api/seller/dashboard/summary').set('Cookie', sellerToken);
      expect(res.status).toBe(200);

      const { data } = res.body;
      // o1 (100) + o3 (100) - o3 refund (50) = 150
      // oOld (1000) is excluded because it's 35 days ago
      // o2 (Confirmed) is excluded
      // o4 (Cancelled) is excluded
      expect(data.sales.revenue).toBe("150.00");
      expect(data.sales.successfulOrders).toBe(2);
    });

    it('should calculate ALL timeframe revenue', async () => {
      const res = await request(app).get('/api/seller/dashboard/summary?timeframe=all').set('Cookie', sellerToken);
      expect(res.status).toBe(200);

      const { data } = res.body;
      // o1 (100) + o3 (100) - o3 refund (50) + oOld (1000) = 1150
      expect(data.sales.revenue).toBe("1150.00");
      expect(data.sales.successfulOrders).toBe(3);
    });

    it('should calculate inventory states accurately', async () => {
      const res = await request(app).get('/api/seller/dashboard/summary').set('Cookie', sellerToken);
      
      const { data } = res.body;
      // prod1: qty=2, threshold=5 (Low Stock)
      // prod2: qty=0, threshold=5 (Out of Stock)
      // prod3: qty=10, threshold=5 (Healthy)
      // prod4: qty=0, threshold=0 (Out of Stock)
      
      expect(data.inventory.lowStockCount).toBe(1);
      expect(data.inventory.outOfStockCount).toBe(2);
    });

    it('should count product statuses using actual Prisma enums', async () => {
      const res = await request(app).get('/api/seller/dashboard/summary').set('Cookie', sellerToken);
      
      const { data } = res.body;
      // prod1, prod2, prod4 are ACTIVE
      // prod3 is PENDING
      expect(data.products.active).toBe(3);
      expect(data.products.pending).toBe(1);
      expect(data.products.rejected).toBe(0);
    });

    it('should aggregate visible reviews for trust metrics', async () => {
      const res = await request(app).get('/api/seller/dashboard/summary').set('Cookie', sellerToken);
      
      const { data } = res.body;
      // 1 Visible review with rating 4
      // 1 Hidden review with rating 2 (excluded)
      expect(data.trust.averageRating).toBe(4);
      expect(data.trust.totalReviews).toBe(1);
    });

    it('should list recent orders needing attention', async () => {
      const res = await request(app).get('/api/seller/dashboard/summary').set('Cookie', sellerToken);
      
      const { data } = res.body;
      // Should only include CONFIRMED/PREPARING/etc, NOT delivered or cancelled
      // o2 is CONFIRMED
      expect(data.recentOrders.length).toBe(1);
      expect(data.recentOrders[0].status).toBe('CONFIRMED');
    });
  });
});
