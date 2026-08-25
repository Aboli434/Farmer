import { z } from 'zod';

export const createReviewSchema = z.object({
  body: z.object({
    orderItemId: z.string().uuid('Invalid order item ID'),
    rating: z.number().int('Rating must be an integer').min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
    comment: z.string().min(10, 'Comment must be at least 10 characters').max(1000, 'Comment must not exceed 1000 characters').optional().or(z.literal('')),
  })
});

export const updateReviewSchema = z.object({
  body: z.object({
    rating: z.number().int('Rating must be an integer').min(1).max(5).optional(),
    comment: z.string().min(10).max(1000).optional().or(z.literal('')),
  }).refine(data => data.rating !== undefined || (data.comment !== undefined && data.comment !== ''), {
    message: "At least one field (rating or comment) must be provided to update"
  })
});
