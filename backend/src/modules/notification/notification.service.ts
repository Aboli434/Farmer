import { PrismaClient, NotificationType, Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';

import { prisma as globalPrisma } from '../../config/prisma';

export class NotificationService {
  /**
   * Create a notification. Supports running inside an existing Prisma transaction.
   */
  static async createNotification(
    data: {
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      entityType?: string;
      entityId?: string;
    },
    tx?: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
  ) {
    const prisma = tx || globalPrisma;

    return await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
      },
    });
  }

  static async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    const [notifications, total] = await Promise.all([
      globalPrisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      globalPrisma.notification.count({ where: { userId } })
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getUnreadCount(userId: string) {
    const count = await globalPrisma.notification.count({
      where: { userId, isRead: false },
    });
    return count;
  }

  static async markAsRead(notificationId: string, userId: string) {
    const notification = await globalPrisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new ApiError(404, 'NOT_FOUND', 'Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to modify this notification');
    }

    return await globalPrisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  static async markAllAsRead(userId: string) {
    await globalPrisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
