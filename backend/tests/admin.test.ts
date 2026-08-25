import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { Role, VerificationStatus } from '@prisma/client';
import { TestFactory } from './helpers/test-factory';

describe('Phase 6 - Admin Verification', () => {
  jest.setTimeout(60000); // remote DB could be slow

  let adminCookie: string;
  let adminId: string;
  let customerCookie: string;
  let customerId: string;
  let verificationId: string;
  let profileId: string;

  beforeAll(async () => {
    // Create Admin
    const { user: admin, session: adminSession } = await TestFactory.createAdmin();
    adminId = admin.id;

    const { signJwt } = require('../src/utils/session');
    const adminToken = signJwt({ userId: adminId, sessionId: adminSession.id });
    adminCookie = `token=${adminToken}; Path=/; HttpOnly`;

    // Create Customer
    const { user: customer, session: customerSession } = await TestFactory.createCustomer();
    customerId = customer.id;

    const customerToken = signJwt({ userId: customerId, sessionId: customerSession.id });
    customerCookie = `token=${customerToken}; Path=/; HttpOnly`;

    // Create Producer Profile & Verification manually because createSeller auto-approves
    const profile = await prisma.producerProfile.create({
      data: {
        userId: customerId,
        farmName: 'Admin Test Farm',
        producerType: 'FARMER',
        story: 'This is a long enough story for the test to pass the 50 characters requirement.',
        pincode: '411001',
        city: 'Pune',
        district: 'Pune',
        state: 'MH'
      }
    });
    profileId = profile.id;

    const verification = await prisma.producerVerification.create({
      data: {
        producerId: profile.id,
        documents: [],
        status: VerificationStatus.PENDING
      }
    });
    verificationId = verification.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
    await prisma.$disconnect();
  });

  // Authorization Tests
  describe('Authorization', () => {
    it('should block unauthenticated requests', async () => {
      const res = await request(app).get('/api/admin/verifications');
      expect(res.status).toBe(401);
    });

    it('should block non-admin roles (CUSTOMER)', async () => {
      const res = await request(app)
        .get('/api/admin/verifications')
        .set('Cookie', customerCookie);
      expect(res.status).toBe(403);
    });
  });

  // Rejection Tests
  describe('Reject Verification', () => {
    it('should reject a pending application', async () => {
      const res = await request(app)
        .post(`/api/admin/verifications/${verificationId}/reject`)
        .set('Cookie', adminCookie)
        .send({ reason: 'Documents are unclear' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.rejectionReason).toBe('Documents are unclear');
      expect(res.body.data.reviewedById).toBe(adminId);

      // Assert user role is STILL CUSTOMER
      const user = await prisma.user.findUnique({ where: { id: customerId } });
      expect(user?.role).toBe(Role.CUSTOMER);
    });

    it('should not allow rejecting an already REJECTED application', async () => {
      const res = await request(app)
        .post(`/api/admin/verifications/${verificationId}/reject`)
        .set('Cookie', adminCookie)
        .send({ reason: 'Should fail' });
      
      expect(res.status).toBe(400); // Because it is no longer PENDING
    });
  });

  // Approval Tests
  describe('Approve Verification', () => {
    beforeAll(async () => {
      // Reset back to PENDING for the approval test
      await prisma.producerVerification.update({
        where: { id: verificationId },
        data: { status: VerificationStatus.PENDING }
      });
    });

    it('should approve a pending application and upgrade role to SELLER', async () => {
      const res = await request(app)
        .post(`/api/admin/verifications/${verificationId}/approve`)
        .set('Cookie', adminCookie);
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.reviewedById).toBe(adminId);

      // Crucial: check User Role
      const user = await prisma.user.findUnique({ where: { id: customerId } });
      expect(user?.role).toBe(Role.SELLER);
    });

    it('should not allow approving an already APPROVED application', async () => {
      const res = await request(app)
        .post(`/api/admin/verifications/${verificationId}/approve`)
        .set('Cookie', adminCookie);
      
      expect(res.status).toBe(400); // Because it is no longer PENDING
    });
  });

  describe('Fetch Verifications', () => {
    it('should fetch list of verifications', async () => {
      const res = await request(app)
        .get('/api/admin/verifications')
        .set('Cookie', adminCookie);
      
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
    });
  });
});
