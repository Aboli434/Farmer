import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { OrderStatus, ReviewStatus, VerificationStatus } from '@prisma/client';
import { signJwt } from '../src/utils/session';
import { TestFactory } from './helpers/test-factory';

describe('Phase 13 - Reviews and Ratings', () => {
  jest.setTimeout(60000);

  let customer1Token: string;
  let customer1Id: string;
  
  let customer2Token: string;
  let customer2Id: string;

  let sellerToken: string;
  let sellerId: string;
  
  let adminToken: string;
  let adminId: string;

  let productId: string;
  let variantId: string;
  
  let orderItem1Id: string; // Belongs to customer 1, Delivered
  let orderItem2Id: string; // Belongs to customer 2, Confirmed (Not Delivered)

  let reviewId: string;

  beforeAll(async () => {
    // 1. Customer 1
    const c1 = await TestFactory.createCustomer({ name: 'Customer One' });
    customer1Id = c1.user.id;
    customer1Token = `token=${signJwt({ userId: c1.user.id, sessionId: c1.session.id })}; Path=/; HttpOnly`;

    // 2. Customer 2
    const c2 = await TestFactory.createCustomer({ name: 'Customer Two' });
    customer2Id = c2.user.id;
    customer2Token = `token=${signJwt({ userId: c2.user.id, sessionId: c2.session.id })}; Path=/; HttpOnly`;

    // 3. Seller
    const s = await TestFactory.createSeller();
    sellerId = s.user.id;
    sellerToken = `token=${signJwt({ userId: s.user.id, sessionId: s.session.id })}; Path=/; HttpOnly`;

    // 4. Admin
    const a = await TestFactory.createAdmin();
    adminId = a.user.id;
    adminToken = `token=${signJwt({ userId: a.user.id, sessionId: a.session.id })}; Path=/; HttpOnly`;

    // 5. Category & Product
    const category = await TestFactory.createCategory('Reviewable Goods');
    const prod = await TestFactory.createProduct(s.profile.id, category.id, { name: 'A2 Cow Ghee', quantity: 100, price: 500 });
    productId = prod.product.id;
    variantId = prod.variant.id;

    // 6. Order 1 (Delivered, Customer 1)
    const o1 = await TestFactory.createTestOrder(customer1Id, sellerId, variantId);
    
    // Update SellerOrder to DELIVERED
    await prisma.sellerOrder.update({
      where: { id: o1.sellerOrder.id },
      data: { status: OrderStatus.DELIVERED }
    });

    const oi1 = await prisma.orderItem.findFirst({ where: { sellerOrderId: o1.sellerOrder.id } });
    orderItem1Id = oi1!.id;

    // 7. Order 2 (Confirmed, Customer 2)
    const o2 = await TestFactory.createTestOrder(customer2Id, sellerId, variantId);
    const oi2 = await prisma.orderItem.findFirst({ where: { sellerOrderId: o2.sellerOrder.id } });
    orderItem2Id = oi2!.id;
  });

  afterAll(async () => {
    await prisma.review.deleteMany({
      where: {
        userId: { in: [customer1Id, customer2Id] }
      }
    });
    await TestFactory.cleanupTestData();
  });

  describe('Review Creation', () => {
    it('should prevent review creation for un-delivered items', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Cookie', customer2Token)
        .send({
          orderItemId: orderItem2Id,
          rating: 5,
          comment: 'Should fail'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('You can only review delivered items');
    });

    it('should prevent review creation if customer did not purchase the item', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Cookie', customer2Token) // Customer 2 trying to review Customer 1's item
        .send({
          orderItemId: orderItem1Id,
          rating: 4
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('You did not purchase this item');
    });

    it('should prevent invalid ratings', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Cookie', customer1Token)
        .send({
          orderItemId: orderItem1Id,
          rating: 6 // Invalid
        });

      expect(res.status).toBe(400); // Validation error
    });

    it('should allow review creation for delivered items (derives productId from orderItemId)', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Cookie', customer1Token)
        .send({
          orderItemId: orderItem1Id,
          rating: 4,
          comment: 'Good product overall.'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.rating).toBe(4);
      expect(res.body.data.productId).toBe(productId); // Backend correctly derived it!
      reviewId = res.body.data.id;
    });

    it('should prevent duplicate reviews for the same orderItem', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Cookie', customer1Token)
        .send({
          orderItemId: orderItem1Id,
          rating: 5
        });

      expect(res.status).toBe(409); // Conflict
    });
  });

  describe('Review Discovery and Modification', () => {
    it('should expose eligible review items to customer', async () => {
      const res = await request(app).get('/api/orders/reviewable-items').set('Cookie', customer1Token);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      
      const item = res.body.data.find((i: any) => i.orderItemId === orderItem1Id);
      expect(item.hasReviewed).toBe(true);
      expect(item.canReview).toBe(false);
    });

    it('should list visible reviews for a product', async () => {
      const res = await request(app).get(`/api/products/${productId}/reviews`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].comment).toBe('Good product overall.');
    });

    it('should correctly calculate producer trust metrics', async () => {
      const sellerProfile = await prisma.producerProfile.findFirst({ where: { userId: sellerId } });
      const res = await request(app).get(`/api/producers/${sellerProfile!.id}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.trustMetrics).toBeDefined();
      expect(res.body.data.trustMetrics.totalReviews).toBe(1);
      expect(res.body.data.trustMetrics.averageRating).toBe(4);
    });

    it('should prevent Customer B from editing Customer A review', async () => {
      const res = await request(app)
        .patch(`/api/reviews/${reviewId}`)
        .set('Cookie', customer2Token)
        .send({ rating: 5 });
        
      expect(res.status).toBe(403);
    });

    it('should allow Customer A to edit their own review', async () => {
      const res = await request(app)
        .patch(`/api/reviews/${reviewId}`)
        .set('Cookie', customer1Token)
        .send({ rating: 5, comment: 'Changed my mind, excellent!' });
        
      expect(res.status).toBe(200);
      expect(res.body.data.rating).toBe(5);
    });
  });

  describe('Moderation and Soft Deletion', () => {
    it('should allow customer to report a review', async () => {
      const res = await request(app).post(`/api/reviews/${reviewId}/report`).set('Cookie', customer2Token);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('FLAGGED');
    });

    it('should expose flagged reviews in admin moderation queue first', async () => {
      const res = await request(app).get('/api/admin/reviews').set('Cookie', adminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].status).toBe('FLAGGED');
    });

    it('should allow admin to hide a review', async () => {
      const res = await request(app)
        .patch(`/api/admin/reviews/${reviewId}/status`)
        .set('Cookie', adminToken)
        .send({ status: 'HIDDEN' });
        
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('HIDDEN');
    });

    it('should omit hidden reviews from product discovery API', async () => {
      const res = await request(app).get(`/api/products/${productId}/reviews`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0); // Hidden
    });

    it('should allow customer to soft delete their review', async () => {
      const res = await request(app).delete(`/api/reviews/${reviewId}`).set('Cookie', customer1Token);
      expect(res.status).toBe(200);
      
      const dbCheck = await prisma.review.findUnique({ where: { id: reviewId } });
      expect(dbCheck!.deletedAt).not.toBeNull();
    });
  });
});
