import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { PaymentWebhookService } from './payment.webhook.service';
import { logger } from '../../utils/logger';

export class PaymentWebhookController {
  static async handleRazorpayWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!secret) {
        logger.error('RAZORPAY_WEBHOOK_SECRET is not defined');
        return res.status(500).json({ success: false, message: 'Server configuration error' });
      }

      const signature = req.headers['x-razorpay-signature'] as string;
      const eventId = req.headers['x-razorpay-event-id'] as string;
      
      // req.body is a Buffer because we used express.raw()
      const bodyString = req.body.toString('utf8');

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(bodyString)
        .digest('hex');

      if (expectedSignature !== signature) {
        logger.warn(`Invalid Razorpay webhook signature for event ${eventId}`);
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }

      const payload = JSON.parse(bodyString);
      const eventType = payload.event;

      // Offload processing to service
      await PaymentWebhookService.processWebhookEvent(eventId, eventType, payload);

      // Acknowledge receipt
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Error handling webhook', { error });
      // Return 500 to tell Razorpay to retry later
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
