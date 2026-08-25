import { Request, Response, NextFunction } from 'express';
import { AdminOrderService } from './admin.order.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class AdminOrderController {
  static async getOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const status = req.query.status as string;
      const producerId = req.query.producerId as string;

      const result = await AdminOrderService.getOrders(page, limit, { status, producerId });
      res.json({ success: true, ...result });
    } catch (error) { next(error); }
  }

  static async forceCancelOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      const adminId = req.user!.id;
      const sellerOrderId = req.params.id as string;

      if (!reason) {
        return res.status(400).json({ success: false, message: 'Cancellation reason is required.' });
      }

      const result = await AdminOrderService.forceCancelOrder(sellerOrderId, adminId, reason);
      res.json({ success: true, message: 'Order force cancelled successfully.', data: result });
    } catch (error) { next(error); }
  }
}
