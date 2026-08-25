import { prisma } from '../../config/prisma';
import { Role, VerificationStatus, ProductStatus, OrderStatus, PaymentStatus, RefundStatus, ReviewStatus } from '@prisma/client';

export class AdminDashboardService {
  static async getSummary() {
    const [
      customers,
      approvedProducers,
      suspendedProducers,
      activeProducts,
      pendingProducts,
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      rejectedOrders,
      failedPaymentsCount,
      pendingRefundsCount,
      deliveredOrdersRevenue,
      processedRefundsTotal
    ] = await Promise.all([
      prisma.user.count({ where: { role: Role.CUSTOMER } }),
      prisma.producerVerification.count({ where: { status: VerificationStatus.APPROVED } }),
      prisma.producerVerification.count({ where: { status: VerificationStatus.SUSPENDED } }),
      prisma.product.count({ where: { status: ProductStatus.ACTIVE, deletedAt: null } }),
      prisma.product.count({ where: { status: ProductStatus.PENDING, deletedAt: null } }),
      prisma.sellerOrder.count(),
      prisma.sellerOrder.count({ where: { status: OrderStatus.DELIVERED } }),
      prisma.sellerOrder.count({ where: { status: OrderStatus.CANCELLED } }),
      prisma.sellerOrder.count({ where: { status: OrderStatus.REJECTED } }),
      prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
      prisma.refund.count({ where: { status: RefundStatus.PENDING } }),
      prisma.sellerOrder.aggregate({
        where: { status: OrderStatus.DELIVERED },
        _sum: { totalAmount: true }
      }),
      prisma.refund.aggregate({
        where: { status: RefundStatus.PROCESSED },
        _sum: { amount: true }
      })
    ]);

    const grossDeliveredRevenue = deliveredOrdersRevenue._sum.totalAmount || 0;
    const processedRefunds = processedRefundsTotal._sum.amount || 0;
    const netDeliveredRevenue = Number(grossDeliveredRevenue) - Number(processedRefunds);

    return {
      users: {
        customers,
        approvedProducers,
        suspendedProducers
      },
      products: {
        activeProducts,
        pendingProducts
      },
      orders: {
        totalOrders,
        deliveredOrders,
        cancelledOrders,
        rejectedOrders
      },
      financials: {
        grossDeliveredRevenue: Number(grossDeliveredRevenue).toFixed(2),
        processedRefunds: Number(processedRefunds).toFixed(2),
        netDeliveredRevenue: netDeliveredRevenue.toFixed(2),
        failedPaymentsCount,
        pendingRefundsCount
      }
    };
  }

  static async getOperationalAlerts() {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const [stuckOrders, flaggedReviews, failedRefunds, failedPayments] = await Promise.all([
      prisma.sellerOrder.findMany({
        where: {
          status: OrderStatus.CONFIRMED,
          createdAt: { lt: fortyEightHoursAgo }
        },
        include: {
          producer: { select: { farmName: true } }
        },
        orderBy: { createdAt: 'asc' },
        take: 50
      }),
      prisma.review.findMany({
        where: { status: ReviewStatus.FLAGGED },
        include: {
          product: { select: { name: true } },
          user: { select: { name: true, phone: true } }
        },
        take: 50
      }),
      prisma.refund.findMany({
        where: { status: RefundStatus.FAILED },
        include: {
          payment: { select: { providerOrderId: true } }
        },
        take: 50
      }),
      prisma.payment.findMany({
        where: { status: PaymentStatus.FAILED },
        take: 50
      })
    ]);

    return {
      stuckOrders,
      flaggedReviews,
      failedRefunds,
      failedPayments
    };
  }
}
