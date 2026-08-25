import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { OrderStatus, TransactionType, PaymentStatus, RefundStatus, NotificationType } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

// Enforce strict state machine transitions
const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.REJECTED]: [],
  [OrderStatus.CANCELLED]: []
};

export class SellerOrderService {
  /**
   * List seller orders for a specific farmer.
   */
  static async getSellerOrders(producerId: string) {
    return await prisma.sellerOrder.findMany({
      where: { producerId },
      include: {
        order: {
          select: {
            createdAt: true,
            user: { select: { name: true, phone: true } },
            shippingAddressSnapshot: true
          }
        },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get detail of a specific seller order.
   */
  static async getSellerOrderDetails(sellerOrderId: string, producerId: string) {
    const order = await prisma.sellerOrder.findFirst({
      where: { id: sellerOrderId, producerId },
      include: {
        order: {
          select: {
            createdAt: true,
            user: { select: { name: true, phone: true } },
            shippingAddressSnapshot: true,
            payments: true
          }
        },
        items: true,
        refunds: true
      }
    });

    if (!order) {
      throw new ApiError(404, 'NOT_FOUND', 'Seller order not found');
    }
    return order;
  }

  /**
   * Update the status of a seller order.
   */
  static async updateSellerOrderStatus(sellerOrderId: string, producerId: string, newStatus: OrderStatus) {
    const sellerOrder = await prisma.sellerOrder.findFirst({
      where: { id: sellerOrderId, producerId },
      include: {
        order: { include: { payments: true } },
        items: true
      }
    });

    if (!sellerOrder) {
      throw new ApiError(404, 'NOT_FOUND', 'Seller order not found');
    }

    const currentStatus = sellerOrder.status;
    const allowedNextStates = allowedTransitions[currentStatus] || [];

    if (!allowedNextStates.includes(newStatus)) {
      throw new ApiError(400, 'BAD_REQUEST', `Cannot transition order from ${currentStatus} to ${newStatus}`);
    }

    // Special case for REJECTED: we need to handle inventory restock and mock refund.
    if (newStatus === OrderStatus.REJECTED) {
      return await prisma.$transaction(async (tx) => {
        const updated = await tx.sellerOrder.update({
          where: { id: sellerOrderId },
          data: { status: OrderStatus.REJECTED, cancellationReason: 'Rejected by seller' }
        });

        // RESTOCK Inventory
        for (const item of sellerOrder.items) {
          const inventory = await tx.inventory.findUnique({
            where: { variantId: item.variantId }
          });

          if (inventory) {
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
                notes: `Order Rejected (SellerOrder ${sellerOrderId})`,
                referenceId: sellerOrderId
              }
            });
          }
        }

        // Mock Refund Process
        const payment = sellerOrder.order.payments[0];
        if (payment) {
          await tx.refund.create({
            data: {
              paymentId: payment.id,
              sellerOrderId: sellerOrderId,
              amount: sellerOrder.totalAmount,
              reason: 'Rejected by seller',
              status: RefundStatus.PROCESSED,
              providerRefundId: `MOCK_REFUND_${Date.now()}_${sellerOrderId}`,
              processedAt: new Date()
            }
          });

          if (payment.status === PaymentStatus.SUCCESS) {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: PaymentStatus.PARTIALLY_REFUNDED }
            });
          }

          // 6. Send Notification to Customer
          await NotificationService.createNotification({
            userId: sellerOrder.order.userId,
            type: NotificationType.ORDER_REJECTED,
            title: 'Order Rejected',
            message: `Seller rejected your order. A refund of ${sellerOrder.totalAmount} has been initiated.`,
            entityType: 'ORDER',
            entityId: sellerOrder.orderId,
          }, tx);

          return updated;
        }
        return updated;
      });
    }

    // For all other transitions (ACCEPTED, PREPARING, etc.)
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.sellerOrder.update({
        where: { id: sellerOrderId },
        data: { status: newStatus }
      });

      const statusToNotificationType: Record<string, NotificationType> = {
        [OrderStatus.ACCEPTED]: NotificationType.ORDER_ACCEPTED,
        [OrderStatus.PREPARING]: NotificationType.ORDER_PREPARING,
        [OrderStatus.READY]: NotificationType.ORDER_READY,
        [OrderStatus.OUT_FOR_DELIVERY]: NotificationType.ORDER_OUT_FOR_DELIVERY,
        [OrderStatus.DELIVERED]: NotificationType.ORDER_DELIVERED,
      };

      const notificationType = statusToNotificationType[newStatus];
      
      if (notificationType) {
        await NotificationService.createNotification({
          userId: sellerOrder.order.userId,
          type: notificationType,
          title: `Order ${newStatus}`,
          message: `Your order status has been updated to ${newStatus}.`,
          entityType: 'ORDER',
          entityId: sellerOrder.orderId,
        }, tx);
      }

      return updated;
    });
  }
}
