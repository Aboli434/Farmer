import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { TestFactory } from './helpers/test-factory';
import { Role, VerificationStatus, OrderStatus } from '@prisma/client';
import { signJwt } from '../src/utils/session';

describe('Phase 15: Admin Marketplace Operations', () => {
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    // Create Admin
    const { user, session } = await TestFactory.createAdmin();
    adminId = user.id;
    adminToken = signJwt({ userId: user.id, sessionId: session.id });
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  describe('1. Audit Logging Service', () => {
    it('should create an audit log on producer approval and allow reading it', async () => {
      // 1. Create a pending verification
      const { user: pendingUser } = await TestFactory.createCustomer();
      const profile = await prisma.producerProfile.create({
        data: {
          userId: pendingUser.id,
          farmName: 'Audit Farm',
          story: 'A test farm',
          city: 'Test City',
          district: 'Test District',
          state: 'TS',
          producerType: 'FARMER',
          addressLine: '123 Test St',
          pincode: '123456',
          latitude: 0,
          longitude: 0,
          verifications: {
            create: {
              status: VerificationStatus.PENDING,
              documents: ['http://test.com/id', 'http://test.com/farm'],
            }
          }
        },
        include: { verifications: true }
      }) as any;
      const verificationId = profile.verifications[0].id;

      // 2. Admin approves it
      const approveRes = await request(app)
        .post(`/api/admin/verifications/${verificationId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(approveRes.status).toBe(200);

      // 3. Read audit logs
      const auditRes = await request(app)
        .get('/api/admin/audit-logs?entityType=ProducerVerification')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.data.length).toBeGreaterThan(0);
      
      const log = auditRes.body.data.find((l: any) => l.entityId === verificationId);
      expect(log).toBeDefined();
      expect(log.action).toBe('APPROVE_PRODUCER');
      expect(log.previousValue.status).toBe('PENDING');
      expect(log.newValue.status).toBe('APPROVED');
    });

    it('should ensure audit log endpoint is read-only (no POST/PUT/DELETE)', async () => {
      const postRes = await request(app).post('/api/admin/audit-logs').set('Authorization', `Bearer ${adminToken}`);
      expect(postRes.status).toBe(404); // Route doesn't exist
    });
  });

  describe('2. Producer Suspension', () => {
    let suspendedProducerId: string;
    let sellerToken: string;

    beforeAll(async () => {
      const { user: seller, session, profile } = await TestFactory.createSeller();
      sellerToken = signJwt({ userId: seller.id, sessionId: session.id });
      suspendedProducerId = profile.id;
    });

    it('should allow admin to suspend producer', async () => {
      const res = await request(app)
        .post(`/api/admin/producers/${suspendedProducerId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Violation of terms' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUSPENDED');
    });

    it('should block suspended producer from creating products', async () => {
      const cat = await TestFactory.createCategory('Suspended Cat');
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Suspended Product',
          description: 'Desc',
          categoryId: cat.id,
          productType: 'PROCESSED_FOOD',
          detail: { isVegetarian: true, ingredients: 'None', productionDate: new Date().toISOString() },
          variants: [{ label: '1kg', unit: 'KG', price: 10, quantity: 10 }]
        });
      
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('suspended');
    });

    it('should hide suspended producers from discovery', async () => {
      const res = await request(app).get('/api/producers');
      expect(res.status).toBe(200);
      const producers = res.body.data;
      expect(producers.some((p: any) => p.id === suspendedProducerId)).toBe(false);
    });
  });

  describe('3. Order Force Cancellation', () => {
    it('should force cancel an order, restock inventory, and log audit', async () => {
      // 1. Create a seller and an order
      const { user: seller, profile } = await TestFactory.createSeller();
      const cat = await TestFactory.createCategory('Cancel Cat');
      const { product, variant, inventory } = await TestFactory.createProduct(profile.id, cat.id, { quantity: 10 });
      
      const { user: customer } = await TestFactory.createCustomer();
      const { order: masterOrder, sellerOrder } = await TestFactory.createTestOrder(customer.id, seller.id, variant.id, { quantity: 2, amount: 100 });

      await prisma.payment.create({
        data: {
          orderId: masterOrder.id,
          amount: 100,
          provider: 'MOCK_GATEWAY',
          providerOrderId: 'pay_force_cancel',
          status: 'SUCCESS'
        }
      });

      // 2. Admin Force Cancels
      const res = await request(app)
        .post(`/api/admin/orders/${sellerOrder.id}/force-cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Customer requested' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');

      // 3. Verify Inventory Restocked
      const updatedInventory = await prisma.inventory.findUnique({ where: { variantId: variant.id } });
      expect(Number(updatedInventory?.availableQuantity)).toBe(Number(inventory.availableQuantity) + 2);

      // 4. Verify Refund Created
      const refund = await prisma.refund.findFirst({ where: { sellerOrderId: sellerOrder.id } });
      expect(refund).toBeDefined();
      expect(refund?.status).toBe('PROCESSED');
    });
  });

  describe('4. Dashboard Metrics', () => {
    it('should return metrics summary', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/summary')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('products');
      expect(res.body.data).toHaveProperty('orders');
      expect(res.body.data).toHaveProperty('financials');
    });

    it('should return operational alerts', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/alerts')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('stuckOrders');
      expect(res.body.data).toHaveProperty('flaggedReviews');
    });
  });
});
