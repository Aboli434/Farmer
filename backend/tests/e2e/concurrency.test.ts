import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { TestFactory } from '../helpers/test-factory';
import { signJwt } from '../../src/utils/session';
import crypto from 'crypto';

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'order_mock_conc', amount: 1000, status: 'created' })
    }
  }));
});

describe('E2E: Concurrency Test - Inventory Overbooking Prevention', () => {
  let customerAToken: string;
  let customerBToken: string;
  let variantId: string;

  beforeAll(async () => {
    const { user: cA, session: sA } = await TestFactory.createCustomer();
    const { user: cB, session: sB } = await TestFactory.createCustomer();
    customerAToken = signJwt({ userId: cA.id, sessionId: sA.id });
    customerBToken = signJwt({ userId: cB.id, sessionId: sB.id });

    // Addresses
    await prisma.address.create({ data: { userId: cA.id, fullName: 'CA', phone: '1', pincode: '411', city: 'A', district: 'A', state: 'A', address: 'A' }});
    await prisma.address.create({ data: { userId: cB.id, fullName: 'CB', phone: '2', pincode: '411', city: 'B', district: 'B', state: 'B', address: 'B' }});

    const { user: seller, profile } = await TestFactory.createSeller();
    const cat = await TestFactory.createCategory('Conc Veggies');
    
    // Exactly 2kg available
    const { variant } = await TestFactory.createProduct(profile.id, cat.id, { quantity: 2 });
    variantId = variant.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('Customer A and Customer B both attempt to buy 2kg simultaneously', async () => {
    // Both add to cart
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${customerAToken}`).send({ variantId, quantity: 2 });
    await request(app).post('/api/cart/items').set('Authorization', `Bearer ${customerBToken}`).send({ variantId, quantity: 2 });

    // Both attempt checkout concurrently
    const [resA, resB] = await Promise.all([
      request(app).post('/api/checkout').set('Authorization', `Bearer ${customerAToken}`).send({ paymentMethod: 'RAZORPAY' }),
      request(app).post('/api/checkout').set('Authorization', `Bearer ${customerBToken}`).send({ paymentMethod: 'RAZORPAY' })
    ]);

    // One must succeed, one must fail with 400 Out of Stock
    const statusCodes = [resA.status, resB.status];
    expect(statusCodes).toContain(200);
    expect(statusCodes).toContain(400);

    const inv = await prisma.inventory.findUnique({ where: { variantId } });
    
    // Final state: 0 available, 2 reserved
    expect(Number(inv?.availableQuantity)).toBe(0);
    expect(Number(inv?.reservedQuantity)).toBe(2);
    expect(Number(inv?.availableQuantity)).not.toBeLessThan(0); // Never negative
  });
});
