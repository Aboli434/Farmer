import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { VerificationStatus, ProducerType, Role } from '@prisma/client';
import { TestFactory } from './helpers/test-factory';
import { signJwt } from '../src/utils/session';

describe('Phase 5 - Producer Registration', () => {
  jest.setTimeout(30000); // Increase timeout for remote DB

  const testPhone = TestFactory.generatePhone();
  let customerCookie: string;
  let userId: string;

  beforeAll(async () => {
    // Targeted pre-clean: remove any stale records for this specific phone
    // from a previous test run. cleanupTestData() can't do this because it
    // only tracks IDs registered in the current session.
    const stale = await prisma.user.findFirst({ where: { phone: testPhone } });
    if (stale) {
      await prisma.producerProfile.deleteMany({ where: { userId: stale.id } });
      await prisma.session.deleteMany({ where: { userId: stale.id } });
      await prisma.user.delete({ where: { id: stale.id } });
    }

    // 1. Create a customer to test with
    const { user, session } = await TestFactory.createCustomer({ phone: testPhone });
    userId = user.id;

    customerCookie = `token=${signJwt({ userId, sessionId: session.id })}; Path=/; HttpOnly`;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  const validApplication = {
    farmName: 'Test Farm',
    producerType: ProducerType.FARMER,
    story: 'This is a very long story about my farm. It has to be at least 50 characters long to pass the Zod validation requirement.',
    addressLine: '123 Farm Road',
    city: 'Pune',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    documents: [
      { type: 'FARM_PHOTO', url: 'https://example.com/photo.jpg' }
    ]
  };

  it('should block unauthenticated requests', async () => {
    const res = await request(app).post('/api/producers/apply').send(validApplication);
    expect(res.status).toBe(401);
  });

  it('should reject application with short story', async () => {
    const res = await request(app)
      .post('/api/producers/apply')
      .set('Cookie', customerCookie)
      .send({ ...validApplication, story: 'Too short' });
    
    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual(expect.objectContaining({ path: ['body', 'story'] }));
  });

  it('should submit application successfully', async () => {
    const res = await request(app)
      .post('/api/producers/apply')
      .set('Cookie', customerCookie)
      .send(validApplication);
    
    expect(res.status).toBe(201);
    expect(res.body.data.profile.farmName).toBe('Test Farm');
    expect(res.body.data.verification.status).toBe('PENDING');
  });

  it('should prevent duplicate applications', async () => {
    const res = await request(app)
      .post('/api/producers/apply')
      .set('Cookie', customerCookie)
      .send(validApplication);
    
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('should allow fetching own profile', async () => {
    const res = await request(app)
      .get('/api/producers/me')
      .set('Cookie', customerCookie);
    
    expect(res.status).toBe(200);
    expect(res.body.data.farmName).toBe('Test Farm');
    expect(res.body.data.verification.status).toBe('PENDING');
  });

  it('should allow updating profile while PENDING', async () => {
    const res = await request(app)
      .patch('/api/producers/me')
      .set('Cookie', customerCookie)
      .send({ farmName: 'Updated Farm Name' });
    
    expect(res.status).toBe(200);
    expect(res.body.data.profile.farmName).toBe('Updated Farm Name');
  });

  it('should allow resubmit only if REJECTED', async () => {
    // Current is PENDING, should fail
    let res = await request(app).post('/api/producers/me/verification/resubmit').set('Cookie', customerCookie);
    expect(res.status).toBe(400);

    // Mock rejection
    const profile = await prisma.producerProfile.findUnique({ where: { userId } });
    await prisma.producerVerification.updateMany({
      where: { producerId: profile!.id },
      data: { status: VerificationStatus.REJECTED, rejectionReason: 'Blurry photos' }
    });

    // Now resubmit should work
    res = await request(app).post('/api/producers/me/verification/resubmit').set('Cookie', customerCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.verification.status).toBe('PENDING');
  });

  it('should block editing sensitive fields if APPROVED', async () => {
    // Mock approval
    const profile = await prisma.producerProfile.findUnique({ where: { userId } });
    await prisma.producerVerification.updateMany({
      where: { producerId: profile!.id },
      data: { status: VerificationStatus.APPROVED }
    });

    // Try changing farmName (sensitive)
    const res1 = await request(app)
      .patch('/api/producers/me')
      .set('Cookie', customerCookie)
      .send({ farmName: 'Hacked Name' });
    
    expect(res1.status).toBe(403);
    expect(res1.body.error.code).toBe('FORBIDDEN');

    // Try changing story (safe)
    const res2 = await request(app)
      .patch('/api/producers/me')
      .set('Cookie', customerCookie)
      .send({ story: 'This is my newly updated long story that is definitely more than 50 characters.' });
    
    expect(res2.status).toBe(200);
    expect(res2.body.data.profile.story).toContain('newly updated long story');
  });
});
