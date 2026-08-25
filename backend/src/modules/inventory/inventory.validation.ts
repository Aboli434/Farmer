import { z } from 'zod';
import { TransactionType } from '@prisma/client';

export const updateInventorySchema = z.object({
  body: z.object({
    adjustmentQuantity: z.number().refine(val => val !== 0, { message: "Adjustment quantity cannot be zero" }),
    type: z.enum([TransactionType.RESTOCK, TransactionType.ADJUSTMENT, TransactionType.DAMAGED, TransactionType.EXPIRED]),
    notes: z.string().optional()
  })
});
