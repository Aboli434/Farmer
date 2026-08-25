import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { Role, ProductStatus, ProducerType, VerificationStatus, ProductType } from '@prisma/client';
import { signJwt } from '../src/utils/session';
import { TestFactory } from './helpers/test-factory';

describe('Phase 9 - Customer Product Discovery', () => {
  jest.setTimeout(60000);
  let customerToken: string;
  let customerId: string;
  let producer1Id: string; // Pune
  let producer2Id: string; // Mumbai
  let p1ProfileId: string;
  let p2ProfileId: string;
  let categoryId: string;
  let productPuneId: string;
  let productMumbaiId: string;
  let addressId: string;

  beforeAll(async () => {
    // 1. Create a Customer
    const { user: customer, session: customerSession } = await TestFactory.createCustomer();
    customerId = customer.id;
    const cToken = signJwt({ userId: customerId, sessionId: customerSession.id });
    customerToken = `token=${cToken}; Path=/; HttpOnly`;

    // 2. Create Producer 1 (Pune)
    const { user: producer1, profile: profile1 } = await TestFactory.createSeller();
    producer1Id = producer1.id;
    p1ProfileId = profile1.id;
    
    // Update profile to be specific for Pune
    await prisma.producerProfile.update({
      where: { id: profile1.id },
      data: { farmName: 'Pune Farm', city: 'Pune', district: 'Pune', pincode: '411001' }
    });

    // 3. Create Producer 2 (Mumbai)
    const { user: producer2, profile: profile2 } = await TestFactory.createSeller();
    producer2Id = producer2.id;
    p2ProfileId = profile2.id;

    // Update profile to be specific for Mumbai
    await prisma.producerProfile.update({
      where: { id: profile2.id },
      data: { farmName: 'Mumbai Farm', city: 'Mumbai', district: 'Mumbai', pincode: '400001' }
    });

    // 4. Create Category
    const category = await TestFactory.createCategory('Dairy Discovery');
    categoryId = category.id;

    // 5. Create Products
    const { product: prodPune, variant: p1Variant } = await TestFactory.createProduct(profile1.id, category.id, { name: 'Pune Ghee', quantity: 10, price: 650 });
    productPuneId = prodPune.id;

    const { product: prodMumbai, variant: p2Variant } = await TestFactory.createProduct(profile2.id, category.id, { name: 'Mumbai Paneer', quantity: 5, price: 150 });
    productMumbaiId = prodMumbai.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  describe('Customer Address APIs', () => {
    it('should allow customer to create an address', async () => {
      const res = await request(app)
        .post('/api/addresses')
        .set('Cookie', [customerToken])
        .send({
          fullName: 'Test User',
          phone: '9999999999',
          pincode: '411001',
          city: 'Pune',
          district: 'Pune',
          state: 'Maharashtra',
          address: '123 Test St',
          isDefault: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      addressId = res.body.data.id;
    });

    it('should list customer addresses', async () => {
      const res = await request(app)
        .get('/api/addresses')
        .set('Cookie', [customerToken]);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('Product Discovery API (Location & Filtering)', () => {
    it('should return products sorted by location relevance (Pune first)', async () => {
      const res = await request(app)
        .get('/api/products?city=Pune&sort=RELEVANCE');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      // First product should be from Pune Farm
      expect(res.body.data[0].producer.farmName).toBe('Pune Farm');
      // Should not contain private data
      expect(res.body.data[0].producer.latitude).toBeUndefined();
      expect(res.body.data[0].producer.addressLine).toBeUndefined();
    });

    it('should filter products by search text', async () => {
      const res = await request(app).get('/api/products?search=ghee');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Pune Ghee');
    });

    it('should exclude products if out of stock', async () => {
      // Set Pune Ghee stock to 0
      const variant = await prisma.productVariant.findFirst({ where: { productId: productPuneId } });
      await prisma.inventory.update({
        where: { variantId: variant!.id },
        data: { availableQuantity: 0 }
      });

      const res = await request(app).get('/api/products?search=ghee');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);

      // Revert stock for next tests
      await prisma.inventory.update({
        where: { variantId: variant!.id },
        data: { availableQuantity: 10 }
      });
    });

    it('should exclude products if producer is suspended', async () => {
      await prisma.producerVerification.updateMany({
        where: { producerId: p1ProfileId },
        data: { status: VerificationStatus.REJECTED }
      });

      const res = await request(app).get('/api/products?search=ghee');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0); // Excluded because producer is not APPROVED

      // Revert verification
      await prisma.producerVerification.updateMany({
        where: { producerId: p1ProfileId },
        data: { status: VerificationStatus.APPROVED }
      });
    });
  });

  describe('Producer Discovery API', () => {
    it('should return nearby producers based on pincode', async () => {
      const res = await request(app).get('/api/producers/nearby?pincode=411001');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].farmName).toBe('Pune Farm');
      // Should return active product count
      expect(res.body.data[0]._count.products).toBe(1);
    });

    it('should return public producer profile without private info', async () => {
      const res = await request(app).get(`/api/producers/${p1ProfileId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.farmName).toBe('Pune Farm');
      expect(res.body.data.addressLine).toBeUndefined();
      expect(res.body.data.pincode).toBeUndefined(); // We excluded this in the select
    });
  });
});
