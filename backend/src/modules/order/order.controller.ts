import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { OrderService } from './order.service';

export const getCustomerOrders = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orders = await OrderService.getCustomerOrders(req.user!.id);
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

export const getCustomerOrderDetails = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const order = await OrderService.getCustomerOrderDetails(req.params.id as string, req.user!.id);
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const cancelSellerOrder = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const updated = await OrderService.cancelSellerOrder(req.params.sellerOrderId as string, req.user!.id);
    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const getReviewableItems = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const items = await OrderService.getReviewableItems(req.user!.id);
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};
