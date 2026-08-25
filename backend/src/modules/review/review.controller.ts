import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { ReviewService } from './review.service';
import { ReviewDiscoveryService } from './review-discovery.service';

export class ReviewController {
  static async createReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { orderItemId, rating, comment } = req.body;
      const review = await ReviewService.createReview(req.user!.id, orderItemId, rating, comment);
      res.status(201).json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }

  static async updateReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reviewId = req.params.id as string;
      const { rating, comment } = req.body;
      const review = await ReviewService.updateReview(req.user!.id, reviewId, rating, comment);
      res.json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }

  static async deleteReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reviewId = req.params.id as string;
      await ReviewService.deleteReview(req.user!.id, reviewId);
      res.json({ success: true, message: 'Review deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async reportReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const reviewId = req.params.id as string;
      const review = await ReviewService.reportReview(req.user!.id, reviewId);
      res.json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }

  static async getProductReviews(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const productId = req.params.productId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const reviews = await ReviewDiscoveryService.getProductReviews(productId, page, limit);
      res.json({ success: true, ...reviews });
    } catch (error) {
      next(error);
    }
  }
}
