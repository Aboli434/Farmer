import { Request, Response, NextFunction } from 'express';
import { CheckoutService } from './checkout.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class CheckoutController {
  static async initiateCheckout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { addressId, idempotencyKey } = req.body;
      const result = await CheckoutService.initiateCheckout(req.user!.id, addressId, idempotencyKey);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const { providerOrderId, status } = req.body;
      const result = await CheckoutService.handleWebhook(providerOrderId, status);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
