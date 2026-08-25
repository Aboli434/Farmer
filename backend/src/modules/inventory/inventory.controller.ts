import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class InventoryController {
  static async updateInventory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const variantId = req.params.variantId as string;
      const userId = req.user!.id;
      const { adjustmentQuantity, type, notes } = req.body;

      const result = await InventoryService.updateInventory(userId, variantId, adjustmentQuantity, type, notes);
      
      res.status(200).json({
        success: true,
        message: 'Inventory updated successfully.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getInventoryHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const variantId = req.params.variantId as string;
      const userId = req.user!.id;

      const result = await InventoryService.getInventoryHistory(userId, variantId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}
