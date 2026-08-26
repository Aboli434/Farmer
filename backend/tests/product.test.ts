import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { Role } from '@prisma/client';
import { TestFactory } from './helpers/test-factory';
import { signJwt } from '../src/utils/session';

describe('Phase 7 - Product Catalog', () => {
  jest.setTimeout(60000);

  let adminCookie: string;
  let sellerCookie: string;
  let customerCookie: string;
  
  let sellerId: string;
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    // Create Admin
    const { user: admin, session: adminSession } = await TestFactory.createAdmin();
    adminCookie = `token=${signJwt({ userId: admin.id, sessionId: adminSession.id })}; Path=/; HttpOnly`;
    
    // Create Seller
    const { user: seller, session: sellerSession } = await TestFactory.createSeller();
    sellerId = seller.id;
    sellerCookie = `token=${signJwt({ userId: seller.id, sessionId: sellerSession.id })}; Path=/; HttpOnly`;

    // Create Customer
    const { user: customer, session: customerSession } = await TestFactory.createCustomer();
    customerCookie = `token=${signJwt({ userId: customer.id, sessionId: customerSession.id })}; Path=/; HttpOnly`;

    const cat = await TestFactory.createCategory('Dairy Products');
    categoryId = cat.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
    await prisma.$disconnect();
  });

  describe('Product Creation & Authorization', () => {
    const payload = {
      categoryId: categoryId,
      name: 'Test Ghee',
      description: 'Pure desi cow ghee, very healthy and nice.',
      productType: 'PROCESSED_FOOD',
      detail: {
        isVegetarian: true,
        ingredients: 'Cow Milk Fat',
        productionDate: new Date().toISOString()
      },
      variants: [
        { label: '500ml', quantity: 500, unit: 'ml', price: 500, initialStock: 10 }
      ]
    };

    it('should prevent CUSTOMER from creating a product', async () => {
      payload.categoryId = categoryId;
      const res = await request(app).post('/api/products').set('Cookie', customerCookie).send(payload);
      expect(res.status).toBe(403);
    });

    it('should validate PROCESSED_FOOD requirements', async () => {
      const invalidPayload = { ...payload, detail: { isVegetarian: true } }; // missing ingredients
      const res = await request(app).post('/api/products').set('Cookie', sellerCookie).send(invalidPayload);
      expect(res.status).toBe(400); // Validation error
    });

    it('should allow SELLER to create a product', async () => {
      const res = await request(app).post('/api/products').set('Cookie', sellerCookie).send(payload);
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
      productId = res.body.data.id;
    });
  });

  describe('Product Moderation (Admin)', () => {
    it('public catalog should NOT show PENDING products', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      // The specific product created in this suite should not be in the public catalog
      const found = res.body.data.find((p: any) => p.id === productId);
      expect(found).toBeUndefined();
    });

    it('admin should see PENDING product and approve it', async () => {
      const listRes = await request(app).get('/api/admin/products').set('Cookie', adminCookie);
      expect(listRes.status).toBe(200);
      // This suite's product must appear in admin list
      const pendingProduct = listRes.body.data.find((p: any) => p.id === productId);
      expect(pendingProduct).toBeDefined();
      expect(pendingProduct.status).toBe('PENDING');

      const approveRes = await request(app).post(`/api/admin/products/${productId}/approve`).set('Cookie', adminCookie);
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('ACTIVE');
    });

    it('public catalog SHOULD show ACTIVE products', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.find((p: any) => p.name === 'Test Ghee');
      expect(found).toBeDefined();
    });
  });

  describe('Product Ownership & Deletion', () => {
    it('seller should be able to soft delete their own product', async () => {
      const res = await request(app).delete(`/api/products/${productId}`).set('Cookie', sellerCookie);
      expect(res.status).toBe(200);

      // Verify soft deletion
      const checkRes = await request(app).get('/api/products');
      expect(checkRes.status).toBe(200);
      const found = checkRes.body.data.find((p: any) => p.id === productId);
      expect(found).toBeUndefined(); // Should be hidden
    });
  });
});
