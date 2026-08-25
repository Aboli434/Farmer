import { Router } from 'express';
import { ProducerController } from './producer.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';
import { applyProducerSchema, updateProducerSchema } from './producer.validation';
import { Role } from '@prisma/client';

const router = Router();

// All producer routes require authentication
router.use(authenticate);

// 1. Apply to become a producer (CUSTOMER only)
router.post(
  '/apply',
  requireRole([Role.CUSTOMER]),
  validateRequest(applyProducerSchema),
  ProducerController.apply
);

// 2. Get own profile (CUSTOMER or SELLER)
router.get(
  '/me',
  requireRole([Role.CUSTOMER, Role.SELLER]),
  ProducerController.getMyProfile
);

// 3. Update own profile (CUSTOMER or SELLER)
router.patch(
  '/me',
  requireRole([Role.CUSTOMER, Role.SELLER]),
  validateRequest(updateProducerSchema),
  ProducerController.updateMyProfile
);

// 4. Resubmit application (CUSTOMER only)
router.post(
  '/me/verification/resubmit',
  requireRole([Role.CUSTOMER]),
  ProducerController.resubmitVerification
);

export default router;
