import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { TestFactory } from './helpers/test-factory';

// Helper to extract the token cookie from supertest response
const getCookie = (res: request.Response) => {
  const cookiesHeader = res.headers['set-cookie'];
  const cookies = Array.isArray(cookiesHeader) ? cookiesHeader : cookiesHeader ? [cookiesHeader] : [];
  return cookies.find((c: string) => c.startsWith('token='));
};

describe('Phase 4 - Authentication & Authorization', () => {
  jest.setTimeout(60000);
  const testPhone = TestFactory.generatePhone();
  let validOtp: string;

  beforeAll(async () => {
    // Tests create data dynamically, no need to clear globally for random phone
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
    await prisma.$disconnect();
  });

  // TEST 1: New User Flow
  describe('Test 1 - New user', () => {
    it('should send OTP successfully', async () => {
      const res = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: testPhone });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      // Grab the generated OTP hash from DB (since we can't easily intercept console.log)
      const otpRecord = await prisma.otpVerification.findFirst({
        where: { phone: testPhone },
        orderBy: { createdAt: 'desc' },
      });
      expect(otpRecord).toBeDefined();

      // We need a way to mock/know the plain OTP. 
      // For testing, let's manually overwrite the hash with a known OTP's hash
      validOtp = '123456';
      const hash = await bcrypt.hash(validOtp, 10);
      await prisma.otpVerification.update({
        where: { id: otpRecord!.id },
        data: { otpHash: hash },
      });
    });

    it('should verify OTP and create new user with CUSTOMER role, returning a cookie', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: validOtp, name: 'Test Farmer' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe(Role.CUSTOMER);
      
      const cookie = getCookie(res);
      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
    });
  });

  // TEST 2: Existing User Flow
  describe('Test 2 - Existing user', () => {
    let cookie: string;

    it('should send OTP again', async () => {
      // First wait 1 second and clear cooldown by faking createdAt
      await prisma.otpVerification.updateMany({
        where: { phone: testPhone },
        data: { createdAt: new Date(Date.now() - 61000) }
      });

      const res = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: testPhone });
      expect(res.status).toBe(200);

      const otpRecord = await prisma.otpVerification.findFirst({
        where: { phone: testPhone },
        orderBy: { createdAt: 'desc' },
      });
      const hash = await bcrypt.hash('654321', 10);
      await prisma.otpVerification.update({
        where: { id: otpRecord!.id },
        data: { otpHash: hash },
      });
    });

    it('should verify OTP and return existing user and new session', async () => {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: '654321' });

      expect(res.status).toBe(200);
      cookie = getCookie(res);
      expect(cookie).toBeDefined();

      // Check DB to ensure multiple sessions exist
      const sessions = await prisma.session.findMany({
        where: { user: { phone: testPhone } }
      });
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });
  });

  // TEST 3: Wrong / Expired OTP
  describe('Test 3 - Wrong / expired OTP', () => {
    it('should fail with wrong OTP', async () => {
      // Bypass cooldown
      await prisma.otpVerification.updateMany({
        where: { phone: testPhone },
        data: { createdAt: new Date(Date.now() - 61000) }
      });

      await request(app).post('/api/auth/send-otp').send({ phone: testPhone });
      const res = await request(app).post('/api/auth/verify-otp').send({ phone: testPhone, otp: '000000' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OTP');
    });

    it('should fail with expired OTP', async () => {
      // Find latest OTP and expire it
      const otpRecord = await prisma.otpVerification.findFirst({
        where: { phone: testPhone },
        orderBy: { createdAt: 'desc' },
      });
      await prisma.otpVerification.update({
        where: { id: otpRecord!.id },
        data: { expiresAt: new Date(Date.now() - 1000) }
      });

      const res = await request(app).post('/api/auth/verify-otp').send({ phone: testPhone, otp: '000000' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EXPIRED_OTP');
    });
  });

  // TEST 4: Max attempts
  describe('Test 4 - Five failed attempts', () => {
    it('should block after 5 failed attempts', async () => {
      await prisma.otpVerification.updateMany({
        where: { phone: testPhone },
        data: { createdAt: new Date(Date.now() - 61000) }
      });
      await request(app).post('/api/auth/send-otp').send({ phone: testPhone });
      
      for (let i = 1; i <= 5; i++) {
        const res = await request(app).post('/api/auth/verify-otp').send({ phone: testPhone, otp: '111111' });
        expect(res.status).toBe(400); // All 5 attempts should be 400 Invalid OTP
      }
      
      // 6th attempt should definitely be blocked
      const blockedRes = await request(app).post('/api/auth/verify-otp').send({ phone: testPhone, otp: '111111' });
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error.code).toBe('MAX_ATTEMPTS');
    });
  });

  // TEST 5: Resend cooldown
  describe('Test 5 - Resend cooldown', () => {
    it('should block immediate resend', async () => {
      // Ensure cooldown is clear
      await prisma.otpVerification.updateMany({
        where: { phone: testPhone },
        data: { createdAt: new Date(Date.now() - 61000) }
      });
      
      await request(app).post('/api/auth/send-otp').send({ phone: testPhone });
      
      const immediateRes = await request(app).post('/api/auth/send-otp').send({ phone: testPhone });
      expect(immediateRes.status).toBe(429);
      expect(immediateRes.body.error.code).toBe('RATE_LIMIT');
    });
  });

  // TEST 6: RBAC
  describe('Test 6 - RBAC protection', () => {
    let customerCookie: string;
    let testApp: any;

    beforeAll(async () => {
      // Create a specific test app to test middleware without hitting the global 404 handler
      const express = require('express');
      const cookieParser = require('cookie-parser');
      const { errorHandler } = require('../src/middleware/errorHandler');
      testApp = express();
      testApp.use(cookieParser());
      
      const { requireAdmin, authenticate } = require('../src/middleware/auth.middleware');
      testApp.get('/api/test-admin', authenticate, requireAdmin, (req: any, res: any) => res.sendStatus(200));
      testApp.use(errorHandler);

      // Login as CUSTOMER
      await prisma.otpVerification.updateMany({
        where: { phone: testPhone },
        data: { createdAt: new Date(Date.now() - 61000) }
      });
      await request(app).post('/api/auth/send-otp').send({ phone: testPhone });
      const otpRecord = await prisma.otpVerification.findFirst({ where: { phone: testPhone }, orderBy: { createdAt: 'desc' } });
      await prisma.otpVerification.update({ where: { id: otpRecord!.id }, data: { otpHash: await bcrypt.hash('222222', 10) }});
      
      const res = await request(app).post('/api/auth/verify-otp').send({ phone: testPhone, otp: '222222' });
      customerCookie = getCookie(res);
    });

    it('should allow CUSTOMER to access /me', async () => {
      const res = await request(app).get('/api/auth/me').set('Cookie', customerCookie);
      expect(res.status).toBe(200);
    });

    // Mocking an admin route to test RBAC
    it('should forbid CUSTOMER from accessing an admin route', async () => {
      const res = await request(testApp).get('/api/test-admin').set('Cookie', customerCookie);
      expect(res.status).toBe(403);
    });
  });

  // TEST 7: Logout / Session Revocation
  describe('Test 7 - Logout / Session revocation', () => {
    let sessionCookie: string;

    beforeAll(async () => {
      await prisma.otpVerification.updateMany({
        where: { phone: testPhone },
        data: { createdAt: new Date(Date.now() - 61000) }
      });
      await request(app).post('/api/auth/send-otp').send({ phone: testPhone });
      const otpRecord = await prisma.otpVerification.findFirst({ where: { phone: testPhone }, orderBy: { createdAt: 'desc' } });
      await prisma.otpVerification.update({ where: { id: otpRecord!.id }, data: { otpHash: await bcrypt.hash('333333', 10) }});
      
      const res = await request(app).post('/api/auth/verify-otp').send({ phone: testPhone, otp: '333333' });
      sessionCookie = getCookie(res);
    });

    it('should revoke single session on logout', async () => {
      await request(app).post('/api/auth/logout').set('Cookie', sessionCookie);
      
      const meRes = await request(app).get('/api/auth/me').set('Cookie', sessionCookie);
      expect(meRes.status).toBe(401);
    });

    it('should revoke all sessions on logout-all', async () => {
      // Login twice to get two cookies
      await prisma.otpVerification.updateMany({ where: { phone: testPhone }, data: { createdAt: new Date(Date.now() - 61000) } });
      await request(app).post('/api/auth/send-otp').send({ phone: testPhone });
      let otpRecord = await prisma.otpVerification.findFirst({ where: { phone: testPhone }, orderBy: { createdAt: 'desc' } });
      await prisma.otpVerification.update({ where: { id: otpRecord!.id }, data: { otpHash: await bcrypt.hash('444444', 10) }});
      const res1 = await request(app).post('/api/auth/verify-otp').send({ phone: testPhone, otp: '444444' });
      const cookie1 = getCookie(res1);

      await prisma.otpVerification.updateMany({ where: { phone: testPhone }, data: { createdAt: new Date(Date.now() - 61000) } });
      await request(app).post('/api/auth/send-otp').send({ phone: testPhone });
      otpRecord = await prisma.otpVerification.findFirst({ where: { phone: testPhone }, orderBy: { createdAt: 'desc' } });
      await prisma.otpVerification.update({ where: { id: otpRecord!.id }, data: { otpHash: await bcrypt.hash('555555', 10) }});
      const res2 = await request(app).post('/api/auth/verify-otp').send({ phone: testPhone, otp: '555555' });
      const cookie2 = getCookie(res2);

      // Verify both work
      expect((await request(app).get('/api/auth/me').set('Cookie', cookie1)).status).toBe(200);
      expect((await request(app).get('/api/auth/me').set('Cookie', cookie2)).status).toBe(200);

      // Logout all using cookie1
      await request(app).post('/api/auth/logout-all').set('Cookie', cookie1);

      // Both should now fail
      expect((await request(app).get('/api/auth/me').set('Cookie', cookie1)).status).toBe(401);
      expect((await request(app).get('/api/auth/me').set('Cookie', cookie2)).status).toBe(401);
    });
  });

  // DB ROLE CHANGE TEST (Source of Truth Test)
  describe('Database Role Change Test', () => {
    let customerCookie: string;
    let userId: string;
    let testApp: any;

    beforeAll(async () => {
      const express = require('express');
      const cookieParser = require('cookie-parser');
      const { errorHandler } = require('../src/middleware/errorHandler');
      testApp = express();
      testApp.use(cookieParser());
      
      const { requireSeller, authenticate } = require('../src/middleware/auth.middleware');
      testApp.get('/api/test-seller', authenticate, requireSeller, (req: any, res: any) => res.sendStatus(200));
      testApp.use(errorHandler);

      await prisma.otpVerification.updateMany({ where: { phone: testPhone }, data: { createdAt: new Date(Date.now() - 61000) } });
      await request(app).post('/api/auth/send-otp').send({ phone: testPhone });
      const otpRecord = await prisma.otpVerification.findFirst({ where: { phone: testPhone }, orderBy: { createdAt: 'desc' } });
      await prisma.otpVerification.update({ where: { id: otpRecord!.id }, data: { otpHash: await bcrypt.hash('666666', 10) }});
      
      const res = await request(app).post('/api/auth/verify-otp').send({ phone: testPhone, otp: '666666' });
      customerCookie = getCookie(res);
      userId = res.body.data.user.id;
    });

    it('should initially forbid CUSTOMER from seller route', async () => {
      const res = await request(testApp).get('/api/test-seller').set('Cookie', customerCookie);
      expect(res.status).toBe(403);
    });

    it('should allow access to same session immediately after DB role changes to SELLER', async () => {
      // Modify role in DB manually (simulating Admin approval)
      await prisma.user.update({
        where: { id: userId },
        data: { role: Role.SELLER }
      });

      // The same JWT cookie should now have access!
      const res = await request(testApp).get('/api/test-seller').set('Cookie', customerCookie);
      expect(res.status).toBe(200);
    });

    it('should deny access to same session immediately after DB role changes back to CUSTOMER', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { role: Role.CUSTOMER }
      });

      const res = await request(testApp).get('/api/test-seller').set('Cookie', customerCookie);
      expect(res.status).toBe(403);
    });
  });

});
