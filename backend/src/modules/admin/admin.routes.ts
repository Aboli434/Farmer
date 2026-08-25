import { Router } from 'express';
import { AdminController } from './admin.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';
import { getVerificationsQuerySchema, rejectVerificationSchema } from './admin.validation';
import { Role } from '@prisma/client';

const router = Router();

// All routes require ADMIN role
router.use(authenticate, requireRole([Role.ADMIN]));

router.get(
  '/verifications',
  validateRequest(getVerificationsQuerySchema),
  AdminController.getVerifications
);

router.get(
  '/verifications/:id',
  AdminController.getVerificationById
);

router.post(
  '/verifications/:id/approve',
  AdminController.approveVerification
);

router.post(
  '/verifications/:id/reject',
  validateRequest(rejectVerificationSchema),
  AdminController.rejectVerification
);

// Product Moderation
router.get('/products', AdminController.getProducts);
router.post('/products/:id/approve', AdminController.approveProduct);
router.post('/products/:id/reject', AdminController.rejectProduct);

export default router;
