import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { TestFactory } from '../helpers/test-factory';
import { signJwt } from '../../src/utils/session';

describe('E2E: Producer Suspension', () => {
  let customerToken: string;
  let adminToken: string;
  let sellerToken: string;
  let producerId: string;
  let productId: string;
  let variantId: string;

  beforeAll(async () => {
    const { user: c, session: sc } = await TestFactory.createCustomer();
    customerToken = signJwt({ userId: c.id, sessionId: sc.id });

    const { user: a, session: sa } = await TestFactory.createAdmin();
    adminToken = signJwt({ userId: a.id, sessionId: sa.id });

    const { user: s, session: ss, profile } = await TestFactory.createSeller();
    sellerToken = signJwt({ userId: s.id, sessionId: ss.id });
    producerId = profile.id;

    const cat = await TestFactory.createCategory('Suspended Veggies');
    const { product, variant } = await TestFactory.createProduct(producerId, cat.id, { quantity: 10 });
    productId = product.id;
    variantId = variant.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('Suspended producer cannot mutate catalog and products disappear from discovery', async () => {
    // 1. Verify product is visible in discovery initially
    let discRes = await request(app).get('/api/products');
    expect(discRes.status).toBe(200);
    let found = discRes.body.data.find((p: any) => p.id === productId);
    expect(found).toBeDefined();

    // 2. Admin Suspends Producer
    const suspRes = await request(app).post(`/api/admin/producers/${producerId}/suspend`).set('Authorization', `Bearer ${adminToken}`).send({ reason: 'Violation' });
    expect(suspRes.status).toBe(200);

    // 3. Producer cannot add products
    const addRes = await request(app).post('/api/products').set('Authorization', `Bearer ${sellerToken}`).send({
      name: 'New Suspended',
      description: 'Desc',
      categoryId: found.categoryId,
      productType: 'FRESH_PRODUCE',
      detail: { isVegetarian: true },
      variants: [{ label: '1kg', unit: 'KG', price: 10, quantity: 10 }]
    });
    expect(addRes.status).toBe(403);
    expect(addRes.body.error?.message).toMatch(/suspended/i);

    // 4. Products disappear from discovery
    discRes = await request(app).get('/api/products');
    found = discRes.body.data.find((p: any) => p.id === productId);
    expect(found).toBeUndefined(); // Gone from discovery!
  });
});
