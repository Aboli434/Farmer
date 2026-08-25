import { Request, Response } from 'express';
import { AdminAuditService } from './admin.audit.service';
import { asyncHandler } from '../../utils/asyncHandler';

export class AdminAuditController {
  static getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const entityType = req.query.entityType as string;
    const action = req.query.action as string;

    const result = await AdminAuditService.getAuditLogs(page, limit, entityType, action);
    
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });
}
