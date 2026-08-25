import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { OrderStatus, TransactionType, PaymentStatus, RefundStatus, NotificationType } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { AdminAuditService } from './admin.audit.service';
import { razorpay } from '../../config/razorpay';
import { logger } from '../../utils/logger';

export class AdminOrderService {
  static async getOrders(page: number, limit: number, filters: any = {}) {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.producerId) where.producerId = filters.producerId;

    const [orders, total] = await Promise.all([
      prisma.sellerOrder.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          producer: { select: { farmName: true } },
          order: {
            select: {
              user: { select: { name: true, phone: true } },
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.sellerOrder.count({ where })
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit)
      }
    };
  }

  static async getOrderById(id: string) {
    const order = await prisma.sellerOrder.findUnique({
      where: { id },
      include: {
        producer: { select: { farmName: true } },
        order: {
          select: {
            user: { select: { name: true, phone: true } },
            payments: true,
            createdAt: true,
            shippingAddressSnapshot: true
          }
        },
        items: true,
        refunds: true
      }
    });

    if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found.');
    return order;
  }

  static async forceCancelOrder(sellerOrderId: string, adminId: string, reason: string) {
    return await prisma.$transaction(async (tx) => {
      const sellerOrder = await tx.sellerOrder.findUnique({
        where: { id: sellerOrderId },
        include: {
          order: { include: { payments: true } },
          items: true
        }
      });

      if (!sellerOrder) {
        throw new ApiError(404, 'NOT_FOUND', 'Seller order not found');
      }

      // Idempotency / State Validation
      if (
        sellerOrder.status === OrderStatus.CANCELLED || 
        sellerOrder.status === OrderStatus.REJECTED || 
        sellerOrder.status === OrderStatus.DELIVERED
      ) {
        throw new ApiError(400, 'BAD_REQUEST', `Cannot force cancel an order that is already ${sellerOrder.status}.`);
      }

      // 1. Update status
      const updated = await tx.sellerOrder.update({
        where: { id: sellerOrderId },
        data: { status: OrderStatus.CANCELLED, cancellationReason: `Admin Force Cancel: ${reason}` }
      });

      // 2. Restock Inventory
      for (const item of sellerOrder.items) {
        const inventory = await tx.inventory.findUnique({
          where: { variantId: item.variantId }
        });

        if (inventory) {
          // If order was CONFIRMED/ACCEPTED, it means soldQuantity was already incremented at checkout.
          // Wait, checkout increments soldQuantity? Yes (or reserved, but Phase 10 moved reserved to sold upon payment success).
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              availableQuantity: { increment: item.quantity },
              soldQuantity: { decrement: item.quantity }
            }
          });

          await tx.inventoryTransaction.create({
            data: {
              inventoryId: inventory.id,
              type: TransactionType.RESTOCK,
              quantityChanged: item.quantity,
              notes: `Admin Force Cancelled Order (SellerOrder ${sellerOrderId})`,
              referenceId: sellerOrderId
            }
          });
        }
      }

      // 3. Process Refund
      const payment = sellerOrder.order.payments[0];
      if (payment) {
        // Prevent duplicate refunds
        const existingRefund = await tx.refund.findFirst({
          where: { sellerOrderId }
        });

        if (!existingRefund) {
          let providerRefundId = `MOCK_REFUND_${Date.now()}_${sellerOrderId}`;
          let initialRefundStatus: RefundStatus = RefundStatus.PROCESSED;

          // Process real Razorpay refund if configured and payment is captured
          if (razorpay && payment.providerPaymentId && payment.status === PaymentStatus.SUCCESS) {
            try {
              const rzpRefund = await razorpay.payments.refund(payment.providerPaymentId, {
                amount: Math.round(Number(sellerOrder.totalAmount) * 100),
                notes: { sellerOrderId, reason }
              });
              providerRefundId = rzpRefund.id;
              // Set to PENDING initially, webhook will mark PROCESSED
              initialRefundStatus = RefundStatus.PENDING; 
            } catch (error: any) {
              logger.error(`Razorpay refund failed for payment ${payment.providerPaymentId}`, { error });
              throw new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Failed to initiate payment refund with provider');
            }
          }

          await tx.refund.create({
            data: {
              paymentId: payment.id,
              sellerOrderId: sellerOrderId,
              amount: sellerOrder.totalAmount,
              reason: `Admin Force Cancel: ${reason}`,
              status: initialRefundStatus,
              providerRefundId,
              processedAt: initialRefundStatus === RefundStatus.PROCESSED ? new Date() : null
            }
          });

          if (payment.status === PaymentStatus.SUCCESS) {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: PaymentStatus.PARTIALLY_REFUNDED } // We use partially refunded because other seller orders in the master order might still be active
            });
          }
        }
      }

      // 4. Notifications
      await NotificationService.createNotification({
        userId: sellerOrder.order.userId,
        type: NotificationType.ORDER_CANCELLED,
        title: 'Order Cancelled by Support',
        message: `Your order for ${sellerOrder.producerNameSnapshot} has been cancelled by support. Reason: ${reason}. A refund has been initiated.`,
        entityType: 'ORDER',
        entityId: sellerOrder.orderId,
      }, tx);

      // Fetch producer to get userId
      const producer = await tx.producerProfile.findUnique({
        where: { id: sellerOrder.producerId },
        select: { userId: true }
      });

      if (producer) {
        await NotificationService.createNotification({
          userId: producer.userId,
          type: NotificationType.ORDER_CANCELLED,
          title: 'Order Cancelled by Support',
          message: `Order #${sellerOrderId} was cancelled by support. Reason: ${reason}.`,
          entityType: 'ORDER',
          entityId: sellerOrderId,
        }, tx);
      }

      // 5. Audit Log
      await AdminAuditService.logAction(tx, {
        adminId,
        action: 'FORCE_CANCEL_ORDER',
        entityType: 'SellerOrder',
        entityId: sellerOrderId,
        previousValue: { status: sellerOrder.status },
        newValue: { status: OrderStatus.CANCELLED },
        reason
      });

      return updated;
    });
  }
}
