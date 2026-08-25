import { Router } from 'express';
import { ReviewController } from './review.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';
import { createReviewSchema, updateReviewSchema } from './review.validation';
import { Role } from '@prisma/client';

const router = Router();

// Customer actions
router.post(
  '/',
  authenticate,
  requireRole([Role.CUSTOMER]),
  validateRequest(createReviewSchema),
  ReviewController.createReview
);

router.patch(
  '/:id',
  authenticate,
  requireRole([Role.CUSTOMER]),
  validateRequest(updateReviewSchema),
  ReviewController.updateReview
);

router.delete(
  '/:id',
  authenticate,
  requireRole([Role.CUSTOMER]),
  ReviewController.deleteReview
);

// Report a review (Customer or Seller)
router.post(
  '/:id/report',
  authenticate,
  ReviewController.reportReview
);

export default router;
