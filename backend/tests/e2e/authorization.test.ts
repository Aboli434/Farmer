import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { TestFactory } from '../helpers/test-factory';
import { signJwt } from '../../src/utils/session';

describe('E2E: Authorization and Security Boundaries', () => {
  let customerToken: string;
  let sellerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const { user: c, session: sc } = await TestFactory.createCustomer();
    customerToken = signJwt({ userId: c.id, sessionId: sc.id });

    const { user: s, session: ss } = await TestFactory.createSeller();
    sellerToken = signJwt({ userId: s.id, sessionId: ss.id });

    const { user: a, session: sa } = await TestFactory.createAdmin();
    adminToken = signJwt({ userId: a.id, sessionId: sa.id });
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('Missing JWT -> 401 Unauthorized', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
  });

  it('Invalid JWT -> 401 Unauthorized', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', 'Bearer invalid_token_here');
    expect(res.status).toBe(401);
  });

  it('Customer accessing Admin API -> 403 Forbidden', async () => {
    const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('Seller accessing Admin API -> 403 Forbidden', async () => {
    const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });
});
