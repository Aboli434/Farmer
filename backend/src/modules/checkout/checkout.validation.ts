import { z } from 'zod';

export const initiateCheckoutSchema = z.object({
  body: z.object({
    addressId: z.string().uuid('Invalid address ID'),
    idempotencyKey: z.string().min(5, 'Idempotency key is required')
  })
});

export const webhookSchema = z.object({
  body: z.object({
    providerOrderId: z.string(),
    status: z.enum(['SUCCESS', 'FAILURE'])
  })
});
