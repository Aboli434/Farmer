import { z } from 'zod';

export const upsertCartItemSchema = z.object({
  body: z.object({
    variantId: z.string().uuid('Invalid variant ID'),
    quantity: z.number().positive('Quantity must be positive')
  })
});
