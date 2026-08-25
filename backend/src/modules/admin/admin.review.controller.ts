import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AdminReviewService } from './admin.review.service';

export class AdminReviewController {
  static async getModerationQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const queue = await AdminReviewService.getModerationQueue(page, limit);
      res.json({ success: true, ...queue });
    } catch (error) {
      next(error);
    }
  }

  static async moderateReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reviewId = req.params.id as string;
      const { status } = req.body;
      
      const updated = await AdminReviewService.moderateReview(reviewId, status, req.user!.id);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}
