import { Router } from 'express';
import { ReviewController } from './review.controller';

const router = Router();

// Mounted at /api/products
router.get(
  '/:productId/reviews',
  ReviewController.getProductReviews
);

export default router;
