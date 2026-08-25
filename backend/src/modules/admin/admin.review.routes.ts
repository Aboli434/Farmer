import { Router } from 'express';
import { AdminReviewController } from './admin.review.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Base path: /api/admin/reviews
// All routes require ADMIN role
router.use(authenticate, requireRole([Role.ADMIN]));

router.get('/', AdminReviewController.getModerationQueue);
router.patch('/:id/status', AdminReviewController.moderateReview);

export default router;
