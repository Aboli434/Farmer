import { Request, Response, NextFunction } from 'express';
import { AdminDashboardService } from './admin.dashboard.service';

export class AdminDashboardController {
  static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await AdminDashboardService.getSummary();
      res.json({ success: true, data: summary });
    } catch (error) { next(error); }
  }

  static async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const alerts = await AdminDashboardService.getOperationalAlerts();
      res.json({ success: true, data: alerts });
    } catch (error) { next(error); }
  }
}
