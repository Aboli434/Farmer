import { Router } from 'express';
import { PaymentWebhookController } from './payment.webhook.controller';

const router = Router();

// This route receives the raw body
router.post(
  '/razorpay',
  PaymentWebhookController.handleRazorpayWebhook
);

export default router;
