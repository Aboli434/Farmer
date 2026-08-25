import { prisma } from '../../config/prisma';
import { Prisma } from '@prisma/client';

export class AdminAuditService {
  /**
   * Helper to consistently format and create audit logs inside a transaction.
   * @param tx Prisma transaction client
   */
  static async logAction(
    tx: Prisma.TransactionClient,
    params: {
      adminId: string;
      action: string;
      entityType: string;
      entityId: string;
      previousValue?: any;
      newValue?: any;
      reason?: string;
    }
  ) {
    return await tx.adminAction.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        previousValue: params.previousValue ? params.previousValue : null,
        newValue: params.newValue ? params.newValue : null,
        reason: params.reason
      }
    });
  }

  static async getAuditLogs(page: number, limit: number, entityType?: string, action?: string) {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;
    
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.adminAction.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      prisma.adminAction.count({ where })
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit)
      }
    };
  }
}
