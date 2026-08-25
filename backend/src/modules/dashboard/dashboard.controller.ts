import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { DashboardService } from './dashboard.service';

export class DashboardController {
  static async getDashboardSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const timeframe = (req.query.timeframe as string) || '30d';
      const summary = await DashboardService.getDashboardSummary(req.user!.id, timeframe);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
}
