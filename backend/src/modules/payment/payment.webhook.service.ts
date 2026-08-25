import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { CheckoutService } from '../checkout/checkout.service';

export class PaymentWebhookService {
  static async processWebhookEvent(eventId: string, eventType: string, payload: any) {
    // 1. Idempotency Check
    const existingEvent = await prisma.paymentWebhookEvent.findUnique({
      where: { providerEventId: eventId }
    });

    if (existingEvent) {
      logger.info(`Webhook event ${eventId} already processed or pending. Skipping.`);
      return;
    }

    // 2. Persist Event (PENDING)
    const webhookEvent = await prisma.paymentWebhookEvent.create({
      data: {
        providerEventId: eventId,
        eventType,
        payload
      }
    });

    try {
      // 3. Process Event based on Type
      const entity = payload.payload?.payment?.entity || payload.payload?.refund?.entity;
      if (!entity) throw new Error('Invalid payload structure');

      if (eventType === 'payment.captured') {
        // Find by providerOrderId from the entity.order_id
        const orderId = entity.order_id;
        if (!orderId) throw new Error('Order ID missing in payment payload');
        
        await CheckoutService.handleWebhook(orderId, 'SUCCESS');
      } 
      else if (eventType === 'payment.failed') {
        const orderId = entity.order_id;
        if (!orderId) throw new Error('Order ID missing in payment payload');

        await CheckoutService.handleWebhook(orderId, 'FAILURE');
      }
      else if (eventType === 'refund.processed') {
        const providerRefundId = entity.id;
        await prisma.refund.update({
          where: { providerRefundId },
          data: { status: 'PROCESSED', processedAt: new Date() }
        });
      }
      else if (eventType === 'refund.failed') {
        const providerRefundId = entity.id;
        await prisma.refund.update({
          where: { providerRefundId },
          data: { status: 'FAILED' }
        });
      }

      // 4. Mark as PROCESSED
      await prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: 'PROCESSED', processedAt: new Date() }
      });
      logger.info(`Webhook event ${eventId} processed successfully.`);

    } catch (error: any) {
      // 5. Mark as FAILED on error
      await prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: 'FAILED', error: error.message }
      });
      logger.error(`Webhook event ${eventId} processing failed: ${error.message}`, { error });
      // We don't rethrow because Razorpay expects a 200 OK so it doesn't indefinitely retry if our DB consistency is intact but data is bad.
      // If it's a transient DB error, Prisma throws and the webhook controller returns 500 so Razorpay retries.
      throw error; 
    }
  }
}
