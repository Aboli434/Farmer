import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { TestFactory } from '../helpers/test-factory';
import { signJwt } from '../../src/utils/session';

let mockIdCounter = 0;
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      // Each call gets a unique order ID — critical for concurrent tests
      create: jest.fn().mockImplementation(() => {
        mockIdCounter++;
        return Promise.resolve({ id: `rzp_conc_${mockIdCounter}`, amount: 10000, status: 'created' });
      })
    }
  }));
});

describe('E2E: Concurrency Test - Inventory Overbooking Prevention', () => {
  let customerAToken: string;
  let customerAId: string;
  let customerBToken: string;
  let customerBId: string;
  let addressAId: string;
  let addressBId: string;
  let variantId: string;

  beforeAll(async () => {
    const { user: cA, session: sA, address: addrA } = await TestFactory.createCustomer();
    const { user: cB, session: sB, address: addrB } = await TestFactory.createCustomer();
    customerAId = cA.id;
    customerBId = cB.id;
    customerAToken = signJwt({ userId: cA.id, sessionId: sA.id });
    customerBToken = signJwt({ userId: cB.id, sessionId: sB.id });
    addressAId = addrA.id;
    addressBId = addrB.id;

    const { profile } = await TestFactory.createSeller();
    const cat = await TestFactory.createCategory('Conc Veggies');
    // Exactly 2 units available — both customers want 2
    const { variant } = await TestFactory.createProduct(profile.id, cat.id, { quantity: 2 });
    variantId = variant.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
  });

  it('Exactly one checkout succeeds; inventory never goes negative; failed order has no orphaned state', async () => {
    // Both add to cart simultaneously
    await Promise.all([
      request(app).post('/api/cart/items').set('Authorization', `Bearer ${customerAToken}`).send({ variantId, quantity: 2 }),
      request(app).post('/api/cart/items').set('Authorization', `Bearer ${customerBToken}`).send({ variantId, quantity: 2 })
    ]);

    // Both attempt checkout simultaneously
    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/checkout/initiate')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ addressId: addressAId, idempotencyKey: `conc_a_${Date.now()}` }),
      request(app)
        .post('/api/checkout/initiate')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ addressId: addressBId, idempotencyKey: `conc_b_${Date.now()}` })
    ]);

    const statuses = [resA.status, resB.status];
    const successRes = resA.status === 200 ? resA : resB.status === 200 ? resB : null;
    const failRes = resA.status !== 200 ? resA : resB;

    // Business invariant 1: Exactly one succeeds
    expect(statuses.filter(s => s === 200).length).toBe(1);

    // Business invariant 2: The failure is a controlled 4xx (not a raw DB error leaking as 500)
    expect(failRes.status).toBeGreaterThanOrEqual(400);
    expect(failRes.status).toBeLessThan(500);
    // Should not expose internal Prisma deadlock errors to clients
    const failBody = JSON.stringify(failRes.body);
    expect(failBody).not.toMatch(/write conflict/i);
    expect(failBody).not.toMatch(/deadlock/i);

    // Business invariant 3: Inventory never goes negative
    const inv = await prisma.inventory.findUnique({ where: { variantId } });
    expect(Number(inv?.availableQuantity)).toBeGreaterThanOrEqual(0);

    // Business invariant 4: Reserved quantity matches what the successful checkout reserved
    if (successRes) {
      // Only 1 reservation exists and it's for 2 units
      const reservations = await prisma.inventoryReservation.findMany({
        where: { inventory: { variantId }, status: 'RESERVED' }
      });
      // The successful checkout reserved 2 units
      const totalReserved = reservations.reduce((sum, r) => sum + Number(r.quantity), 0);
      expect(totalReserved).toBe(2);

      // The failed customer has no reservation
      const failedUserId = failRes === resA ? customerAId : customerBId;
      const failedReservation = await prisma.inventoryReservation.findFirst({
        where: { userId: failedUserId, inventory: { variantId }, status: 'RESERVED' }
      });
      expect(failedReservation).toBeNull();
    }

    // Business invariant 5: Total of available + reserved = original 2
    expect(Number(inv?.availableQuantity) + Number(inv?.reservedQuantity)).toBe(2);
  });
});
