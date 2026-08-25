import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class AdminController {
  static async getVerifications(req: Request, res: Response, next: NextFunction) {
    try {
      // The query is parsed by zod in validateRequest middleware, so we can cast it
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const status = req.query.status as any;

      const result = await AdminService.getVerifications(page, limit, status);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getVerificationById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await AdminService.getVerificationById(id);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async approveVerification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const adminId = req.user!.id;

      const result = await AdminService.approveVerification(id, adminId);
      
      res.status(200).json({
        success: true,
        message: 'Producer verification approved successfully.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async rejectVerification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const adminId = req.user!.id;
      const { reason } = req.body;

      const result = await AdminService.rejectVerification(id, adminId, reason);
      
      res.status(200).json({
        success: true,
        message: 'Producer verification rejected.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async suspendProducer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const producerId = req.params.id as string;
      const adminId = req.user!.id;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ success: false, message: 'Reason is required for suspension.' });
      }

      const result = await AdminService.suspendProducer(producerId, adminId, reason);
      
      res.status(200).json({
        success: true,
        message: 'Producer suspended successfully.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  // =====================================
  // PRODUCT MODERATION
  // =====================================
  static async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const status = req.query.status as any;

      const result = await AdminService.getProducts(page, limit, status);
      
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  }

  static async approveProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const adminId = req.user!.id;
      const result = await AdminService.approveProduct(id, adminId);
      res.status(200).json({ success: true, message: 'Product approved.', data: result });
    } catch (error) { next(error); }
  }

  static async rejectProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const adminId = req.user!.id;
      const { reason } = req.body;
      const result = await AdminService.rejectProduct(id, adminId, reason);
      res.status(200).json({ success: true, message: 'Product rejected.', data: result });
    } catch (error) { next(error); }
  }
}
