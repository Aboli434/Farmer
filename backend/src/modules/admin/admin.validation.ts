import { z } from 'zod';
import { VerificationStatus } from '@prisma/client';

export const getVerificationsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().default('1').transform(Number),
    limit: z.string().regex(/^\d+$/).optional().default('20').transform(Number),
    status: z.nativeEnum(VerificationStatus).optional(),
  })
});

export const rejectVerificationSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(10, 'Rejection reason must be at least 10 characters').max(500, 'Rejection reason must not exceed 500 characters'),
  })
});
