import { Request, Response, NextFunction } from 'express';
import { CartService } from './cart.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class CartController {
  static async getCart(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const cart = await CartService.getCart(req.user!.id);
      res.status(200).json({ success: true, data: cart });
    } catch (error) {
      next(error);
    }
  }

  static async upsertItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { variantId, quantity } = req.body;
      const cart = await CartService.upsertItem(req.user!.id, variantId, quantity);
      res.status(200).json({ success: true, data: cart });
    } catch (error) {
      next(error);
    }
  }

  static async removeItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { variantId } = req.params;
      const cart = await CartService.removeItem(req.user!.id, variantId as string);
      res.status(200).json({ success: true, data: cart });
    } catch (error) {
      next(error);
    }
  }

  static async clearCart(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const cart = await CartService.clearCart(req.user!.id);
      res.status(200).json({ success: true, data: cart });
    } catch (error) {
      next(error);
    }
  }
}
