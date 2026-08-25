import { prisma } from '../../config/prisma';
import { InventoryService } from './inventory.service';
import { ReservationStatus } from '@prisma/client';

export async function releaseExpiredReservations() {
  const expiredReservations = await prisma.inventoryReservation.findMany({
    where: {
      status: ReservationStatus.RESERVED,
      expiresAt: { lte: new Date() }
    }
  });

  let count = 0;
  for (const res of expiredReservations) {
    try {
      await InventoryService.releaseInventory(res.id);
      count++;
    } catch (error) {
      console.error(`Failed to release reservation ${res.id}:`, error);
    }
  }
  return count;
}
