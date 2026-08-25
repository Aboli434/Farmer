import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { OrderStatus, TransactionType, PaymentStatus, RefundStatus, Prisma, NotificationType } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationService } from '../notification/notification.service';

export class OrderService {
  /**
   * List all master orders for a customer (with embedded seller orders).
   */
  static async getCustomerOrders(userId: string) {
    return await prisma.order.findMany({
      where: { userId },
      include: {
        sellerOrders: {
          include: {
            producer: {
              select: { farmName: true }
            },
            items: true
          }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get master order details for a customer.
   */
  static async getCustomerOrderDetails(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        sellerOrders: {
          include: {
            producer: {
              select: { farmName: true }
            },
            items: {
              include: {
                variant: {
                  include: { product: true }
                }
              }
            },
            refunds: true
          }
        },
        payments: true
      }
    });

    if (!order) {
      throw new ApiError(404, 'NOT_FOUND', 'Order not found');
    }
    return order;
  }

  /**
   * Cancel a specific SellerOrder (by Customer).
   * Only allowed when status is CONFIRMED.
   */
  static async cancelSellerOrder(sellerOrderId: string, userId: string) {
    // 1. Validate ownership and state
    const sellerOrder = await prisma.sellerOrder.findUnique({
      where: { id: sellerOrderId },
      include: { 
        order: {
          include: { payments: true }
        },
        producer: true,
        items: true
      }
    });

    if (!sellerOrder || sellerOrder.order.userId !== userId) {
      throw new ApiError(404, 'NOT_FOUND', 'Seller order not found');
    }

    if (sellerOrder.status !== OrderStatus.CONFIRMED) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        `Cannot cancel order in ${sellerOrder.status} state. Only CONFIRMED orders can be cancelled by customers.`
      );
    }

    // 2. Perform Transaction: CANCEL SellerOrder + RESTOCK Inventory + process Refund
    return await prisma.$transaction(async (tx) => {
      // a. Mark SellerOrder as CANCELLED
      const updatedSellerOrder = await tx.sellerOrder.update({
        where: { id: sellerOrderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancellationReason: 'Cancelled by customer'
        }
      });

      // b. RESTOCK Inventory
      for (const item of sellerOrder.items) {
        // Find inventory
        const inventory = await tx.inventory.findUnique({
          where: { variantId: item.variantId }
        });

        if (inventory) {
          // Increase available quantity, decrease sold quantity
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              availableQuantity: { increment: item.quantity },
              soldQuantity: { decrement: item.quantity }
            }
          });

          // Log RESTOCK transaction
          await tx.inventoryTransaction.create({
            data: {
              inventoryId: inventory.id,
              type: TransactionType.RESTOCK,
              quantityChanged: item.quantity,
              notes: `Order Cancelled (SellerOrder ${sellerOrderId})`,
              referenceId: sellerOrderId
            }
          });
        }
      }

      // c. Handle mock Refund
      const payment = sellerOrder.order.payments[0]; // Assuming 1 payment per order for MVP
      
      if (payment) {
        // Create Refund record
        await tx.refund.create({
          data: {
            paymentId: payment.id,
            sellerOrderId: sellerOrderId,
            amount: sellerOrder.totalAmount, // refunding the seller subtotal (delivery is 0)
            reason: 'Cancelled by customer',
            status: RefundStatus.PROCESSED,
            providerRefundId: `MOCK_REFUND_${Date.now()}_${sellerOrderId}`,
            processedAt: new Date()
          }
        });

        // Update Payment summary status to PARTIALLY_REFUNDED if it was SUCCESS
        // If ALL seller orders are CANCELLED/REJECTED, it would logically be fully REFUNDED, 
        // but for MVP, PARTIALLY_REFUNDED handles everything properly.
        if (payment.status === PaymentStatus.SUCCESS) {
           await tx.payment.update({
             where: { id: payment.id },
             data: { status: PaymentStatus.PARTIALLY_REFUNDED }
           });
        }
      }

      // 5. Create Notification for Seller
      await NotificationService.createNotification({
        userId: sellerOrder.producer.userId,
        type: NotificationType.ORDER_CANCELLED,
        title: 'Order Cancelled',
        message: `Customer cancelled order for ${sellerOrder.totalAmount}. Inventory has been restocked.`,
        entityType: 'SELLER_ORDER',
        entityId: sellerOrder.id,
      }, tx);

      return updatedSellerOrder;
    });
  }
  /**
   * Get eligible order items for reviewing.
   * Items must belong to the user, the seller order must be DELIVERED, and it must not be reviewed yet.
   */
  static async getReviewableItems(userId: string) {
    const items = await prisma.orderItem.findMany({
      where: {
        sellerOrder: {
          order: { userId },
          status: 'DELIVERED'
        }
      },
      include: {
        review: true,
        variant: {
          include: { product: true }
        }
      }
    });

    return items.map(item => ({
      orderItemId: item.id,
      productId: item.variant.productId,
      productName: item.productNameSnapshot,
      variantLabel: item.variantLabelSnapshot,
      canReview: !item.review,
      hasReviewed: !!item.review,
      reviewId: item.review?.id
    }));
  }
}
