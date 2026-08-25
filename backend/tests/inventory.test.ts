import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { Role, TransactionType, ReservationStatus } from '@prisma/client';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { TestFactory } from './helpers/test-factory';
import { signJwt } from '../src/utils/session';

describe('Phase 8 - Inventory Management', () => {
  jest.setTimeout(60000);

  let sellerCookie: string;
  let customerCookie: string;
  let sellerId: string;
  let customerId: string;
  let variantId: string;
  let inventoryId: string;
  let reservationId: string;

  beforeAll(async () => {
    const { user: seller, session: sellerSession } = await TestFactory.createSeller();
    sellerId = seller.id;

    const { user: customer, session: customerSession } = await TestFactory.createCustomer();
    customerId = customer.id;

    sellerCookie = `token=${signJwt({ userId: seller.id, sessionId: sellerSession.id })}; Path=/; HttpOnly`;
    customerCookie = `token=${signJwt({ userId: customer.id, sessionId: customerSession.id })}; Path=/; HttpOnly`;

    const cat = await TestFactory.createCategory('Inv Cat');

    // Create a product to get an inventory
    const res = await request(app).post('/api/products').set('Cookie', sellerCookie).send({
      categoryId: cat.id,
      name: 'Inv Product',
      description: 'Test inventory product',
      productType: 'PROCESSED_FOOD',
      detail: {
        isVegetarian: true,
        ingredients: 'Test',
        productionDate: new Date().toISOString()
      },
      variants: [
        { label: '500ml', quantity: 500, unit: 'ml', price: 500, initialStock: 10 }
      ]
    });

    variantId = res.body.data.variants[0].id;
    inventoryId = res.body.data.variants[0].inventory.id;
  });

  afterAll(async () => {
    await TestFactory.cleanupTestData();
    await prisma.$disconnect();
  });

  describe('Seller Inventory Adjustments', () => {
    it('should allow seller to restock', async () => {
      const res = await request(app).patch(`/api/inventory/${variantId}`).set('Cookie', sellerCookie).send({
        adjustmentQuantity: 5,
        type: TransactionType.RESTOCK,
        notes: 'Restocked'
      });
      expect(res.status).toBe(200);
      expect(Number(res.body.data.availableQuantity)).toBe(15);
    });

    it('should reject negative resulting stock', async () => {
      const res = await request(app).patch(`/api/inventory/${variantId}`).set('Cookie', sellerCookie).send({
        adjustmentQuantity: -20,
        type: TransactionType.DAMAGED
      });
      expect(res.status).toBe(400); // Bad Request (Negative)
    });

    it('should log transactions for restock', async () => {
      const res = await request(app).get(`/api/inventory/${variantId}/history`).set('Cookie', sellerCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2); // Initial + Restock
      expect(res.body.data[0].type).toBe(TransactionType.RESTOCK);
    });
  });

  describe('Internal Reservations (Checkout Sim)', () => {
    it('should reserve stock and decrease available', async () => {
      const res = await InventoryService.reserveInventory(variantId, customerId, 3);
      reservationId = res.id;
      expect(res.status).toBe(ReservationStatus.RESERVED);

      const inv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
      expect(Number(inv!.availableQuantity)).toBe(12); // 15 - 3
      expect(Number(inv!.reservedQuantity)).toBe(3);
    });

    it('should reject reservation if insufficient stock', async () => {
      await expect(InventoryService.reserveInventory(variantId, customerId, 100))
        .rejects.toThrow('Insufficient stock');
    });

    it('should confirm reservation idempotently', async () => {
      await InventoryService.confirmInventory(reservationId);
      
      const inv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
      expect(Number(inv!.availableQuantity)).toBe(12);
      expect(Number(inv!.reservedQuantity)).toBe(0);
      expect(Number(inv!.soldQuantity)).toBe(3);

      // Call again, should not change numbers
      await InventoryService.confirmInventory(reservationId);
      const inv2 = await prisma.inventory.findUnique({ where: { id: inventoryId } });
      expect(Number(inv2!.soldQuantity)).toBe(3);
    });
  });

  describe('Concurrency Protection', () => {
    it('should prevent overselling on simultaneous requests', async () => {
      // Current available is 12. Let's try to reserve 5 items 3 times concurrently.
      // Total 15 needed. It should fulfill 2 (10 total) and fail 1.
      const req1 = InventoryService.reserveInventory(variantId, customerId, 5);
      const req2 = InventoryService.reserveInventory(variantId, customerId, 5);
      const req3 = InventoryService.reserveInventory(variantId, customerId, 5);

      const results = await Promise.allSettled([req1, req2, req3]);
      
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');
      
      expect(successes.length).toBeGreaterThanOrEqual(1);
      expect(successes.length).toBeLessThanOrEqual(2);

      const inv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
      expect(Number(inv!.availableQuantity)).toBeGreaterThanOrEqual(2);
      expect(Number(inv!.reservedQuantity)).toBeLessThanOrEqual(10);
    });
  });
});
