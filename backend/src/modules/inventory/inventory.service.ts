import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { TransactionType, ReservationStatus, Prisma } from '@prisma/client';

export class InventoryService {
  static async updateInventory(userId: string, variantId: string, adjustmentQuantity: number, type: TransactionType, notes?: string) {
    // 1. Ownership Check
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: { select: { producerId: true } },
        inventory: true
      }
    });

    if (!variant || !variant.inventory) {
      throw new ApiError(404, 'NOT_FOUND', 'Variant or Inventory not found.');
    }

    const profile = await prisma.producerProfile.findUnique({ where: { userId } });
    if (!profile || profile.id !== variant.product.producerId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this inventory.');
    }

    // 2. Validate resulting stock
    const currentAvailable = Number(variant.inventory.availableQuantity);
    const newAvailable = currentAvailable + adjustmentQuantity;

    if (newAvailable < 0) {
      throw new ApiError(400, 'BAD_REQUEST', `Adjustment rejected. Resulting available stock cannot be negative (current: ${currentAvailable}).`);
    }

    // 3. Atomic Update
    return await prisma.$transaction(async (tx) => {
      const updatedInventory = await tx.inventory.update({
        where: { id: variant.inventory!.id },
        data: {
          availableQuantity: newAvailable
        }
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: variant.inventory!.id,
          type,
          quantityChanged: adjustmentQuantity,
          notes
        }
      });

      return updatedInventory;
    });
  }

  static async reserveInventory(variantId: string, userId: string, quantity: number, existingTx?: Prisma.TransactionClient) {
    const runInTx = async (tx: Prisma.TransactionClient) => {
      // Find variant and strictly check stock during tx
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        include: { inventory: true }
      });

      if (!variant || !variant.inventory) {
        throw new ApiError(404, 'NOT_FOUND', 'Variant or Inventory not found.');
      }

      if (Number(variant.inventory.availableQuantity) < quantity) {
        throw new ApiError(400, 'BAD_REQUEST', 'Insufficient stock.');
      }

      const updatedInventory = await tx.inventory.update({
        where: { id: variant.inventory.id },
        data: {
          availableQuantity: { decrement: quantity },
          reservedQuantity: { increment: quantity }
        }
      });

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      const reservation = await tx.inventoryReservation.create({
        data: {
          inventoryId: variant.inventory.id,
          userId,
          quantity,
          expiresAt,
          status: ReservationStatus.RESERVED
        }
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: variant.inventory.id,
          type: TransactionType.RESERVATION,
          quantityChanged: -quantity,
          referenceId: reservation.id
        }
      });

      return reservation;
    };

    if (existingTx) {
      return await runInTx(existingTx);
    } else {
      return await prisma.$transaction(runInTx, { isolationLevel: 'Serializable' });
    }
  }

  static async confirmInventory(reservationId: string, existingTx?: Prisma.TransactionClient) {
    const runInTx = async (tx: Prisma.TransactionClient) => {
      const res = await tx.inventoryReservation.findUnique({
        where: { id: reservationId },
        include: { inventory: true }
      });

      if (!res) throw new ApiError(404, 'NOT_FOUND', 'Reservation not found.');
      
      // Idempotency
      if (res.status === ReservationStatus.CONFIRMED) return res;
      if (res.status === ReservationStatus.EXPIRED) throw new ApiError(400, 'BAD_REQUEST', 'Reservation already expired.');

      const updatedRes = await tx.inventoryReservation.update({
        where: { id: res.id },
        data: { status: ReservationStatus.CONFIRMED }
      });

      await tx.inventory.update({
        where: { id: res.inventoryId },
        data: {
          reservedQuantity: { decrement: res.quantity },
          soldQuantity: { increment: res.quantity }
        }
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: res.inventoryId,
          type: TransactionType.SALE,
          quantityChanged: 0,
          referenceId: res.id,
          notes: 'Reservation confirmed to sale'
        }
      });

      return updatedRes;
    };

    if (existingTx) return await runInTx(existingTx);
    return await prisma.$transaction(runInTx);
  }

  static async releaseInventory(reservationId: string, existingTx?: Prisma.TransactionClient) {
    const runInTx = async (tx: Prisma.TransactionClient) => {
      const res = await tx.inventoryReservation.findUnique({
        where: { id: reservationId }
      });

      if (!res) throw new ApiError(404, 'NOT_FOUND', 'Reservation not found.');

      if (res.status === ReservationStatus.EXPIRED || res.status === ReservationStatus.CONFIRMED) {
        return res; // Idempotent
      }

      const updatedRes = await tx.inventoryReservation.update({
        where: { id: res.id },
        data: { status: ReservationStatus.EXPIRED }
      });

      await tx.inventory.update({
        where: { id: res.inventoryId },
        data: {
          reservedQuantity: { decrement: res.quantity },
          availableQuantity: { increment: res.quantity }
        }
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: res.inventoryId,
          type: TransactionType.RELEASE,
          quantityChanged: Number(res.quantity),
          referenceId: res.id,
          notes: 'Reservation Released/Expired'
        }
      });

      return updatedRes;
    };

    if (existingTx) return await runInTx(existingTx);
    return await prisma.$transaction(runInTx);
  }

  static async getInventoryHistory(userId: string, variantId: string) {
    const profile = await prisma.producerProfile.findUnique({ where: { userId } });
    if (!profile) throw new ApiError(404, 'NOT_FOUND', 'Producer profile not found.');

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true, inventory: true }
    });

    if (!variant || !variant.inventory) throw new ApiError(404, 'NOT_FOUND', 'Inventory not found.');
    if (variant.product.producerId !== profile.id) throw new ApiError(403, 'FORBIDDEN', 'Permission denied.');

    return await prisma.inventoryTransaction.findMany({
      where: { inventoryId: variant.inventory.id },
      orderBy: { createdAt: 'desc' }
    });
  }
}
