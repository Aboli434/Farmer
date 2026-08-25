import { Router } from 'express';
import { CheckoutController } from './checkout.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';
import { initiateCheckoutSchema, webhookSchema } from './checkout.validation';
import { Role } from '@prisma/client';

const router = Router();

router.post(
  '/initiate',
  authenticate,
  requireRole([Role.CUSTOMER]),
  validateRequest(initiateCheckoutSchema),
  CheckoutController.initiateCheckout
);

// Webhook is public (simulated provider calling us back)
router.post(
  '/webhook',
  validateRequest(webhookSchema),
  CheckoutController.handleWebhook
);

export default router;
