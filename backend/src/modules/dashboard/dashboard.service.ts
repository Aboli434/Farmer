import { prisma } from '../../config/prisma';
import { OrderStatus, ProductStatus, RefundStatus } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';

export class DashboardService {
  /**
   * Get consolidated dashboard summary for a seller.
   */
  static async getDashboardSummary(userId: string, timeframe: string = '30d') {
    // 1. Validate Producer
    const producer = await prisma.producerProfile.findUnique({
      where: { userId },
      include: { verifications: { where: { status: 'APPROVED' } } }
    });

    if (!producer || producer.verifications.length === 0) {
      throw new ApiError(403, 'FORBIDDEN', 'Dashboard access requires an approved seller profile');
    }

    const producerId = producer.id;

    // 2. Parse Timeframe
    let fromDate: Date | null = null;
    if (timeframe !== 'all') {
      const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30; // default 30d
      fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    const timeFilter = fromDate ? { createdAt: { gte: fromDate } } : {};

    // 3. Parallel Data Aggregation
    const [
      orders,
      refunds,
      products,
      inventoryItems,
      reviewAgg,
      recentOrders
    ] = await Promise.all([
      // a. Orders for the given timeframe
      prisma.sellerOrder.findMany({
        where: { producerId, ...timeFilter },
        select: { status: true, totalAmount: true }
      }),
      // b. Processed refunds for the seller's orders in the timeframe
      prisma.refund.findMany({
        where: {
          sellerOrder: { producerId, ...timeFilter },
          status: RefundStatus.PROCESSED
        },
        select: { amount: true }
      }),
      // c. Product status counts (current state, independent of timeframe)
      prisma.product.groupBy({
        by: ['status'],
        where: { producerId, deletedAt: null },
        _count: true
      }),
      // d. Inventory levels (current state)
      prisma.inventory.findMany({
        where: {
          variant: { product: { producerId, deletedAt: null } }
        },
        select: { availableQuantity: true, lowStockThreshold: true }
      }),
      // e. Trust metrics (current state)
      prisma.review.aggregate({
        where: {
          product: { producerId },
          status: 'VISIBLE',
          deletedAt: null
        },
        _avg: { rating: true },
        _count: { rating: true }
      }),
      // f. Recent Orders needing attention
      prisma.sellerOrder.findMany({
        where: {
          producerId,
          status: { in: [OrderStatus.CONFIRMED, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY] }
        },
        orderBy: [
          // Order by urgency - Prisma orderBy on enum might be alphabetical in some DBs, 
          // so we'll fetch and sort in memory if needed, or rely on Date for now and sort in memory.
          { createdAt: 'asc' }
        ],
        take: 50 // Fetch a chunk to sort by priority in memory
      })
    ]);

    // 4. Calculate Sales & Revenue
    let totalRevenue = 0;
    let successfulOrdersCount = 0;
    const orderStatusCounts: Record<string, number> = {
      CONFIRMED: 0, ACCEPTED: 0, PREPARING: 0, READY: 0, 
      OUT_FOR_DELIVERY: 0, DELIVERED: 0, CANCELLED: 0, REJECTED: 0
    };

    for (const order of orders) {
      orderStatusCounts[order.status] = (orderStatusCounts[order.status] || 0) + 1;
      if (order.status === OrderStatus.DELIVERED) {
        successfulOrdersCount++;
        totalRevenue += Number(order.totalAmount);
      }
    }

    const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.amount), 0);
    const netRevenue = Math.max(0, totalRevenue - totalRefunds);

    // 5. Format Product Counts
    const productCounts: Record<string, number> = {
      active: 0, pending: 0, rejected: 0, inactive: 0, draft: 0
    };
    for (const group of products) {
      const key = group.status.toLowerCase();
      if (key in productCounts) {
        productCounts[key] = group._count;
      }
    }

    // 6. Calculate Inventory Alerts
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const item of inventoryItems) {
      const qty = Number(item.availableQuantity);
      const threshold = Number(item.lowStockThreshold);
      if (qty === 0) {
        outOfStockCount++;
      } else if (qty <= threshold) {
        lowStockCount++;
      }
    }

    // 7. Sort Recent Orders by Urgency
    const statusPriority: Record<string, number> = {
      CONFIRMED: 1,
      ACCEPTED: 2,
      PREPARING: 3,
      READY: 4,
      OUT_FOR_DELIVERY: 5
    };

    recentOrders.sort((a, b) => {
      const pA = statusPriority[a.status] || 99;
      const pB = statusPriority[b.status] || 99;
      if (pA !== pB) return pA - pB;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const topRecentOrders = recentOrders.slice(0, 5);

    // 8. Return Consolidated Payload
    return {
      timeframe: timeframe === 'all' ? 'all' : (fromDate ? `${timeframe}` : '30d'),
      sales: {
        revenue: netRevenue.toFixed(2),
        successfulOrders: successfulOrdersCount
      },
      orders: {
        confirmed: orderStatusCounts.CONFIRMED || 0,
        accepted: orderStatusCounts.ACCEPTED || 0,
        preparing: orderStatusCounts.PREPARING || 0,
        ready: orderStatusCounts.READY || 0,
        outForDelivery: orderStatusCounts.OUT_FOR_DELIVERY || 0,
        delivered: orderStatusCounts.DELIVERED || 0,
        cancelled: orderStatusCounts.CANCELLED || 0,
        rejected: orderStatusCounts.REJECTED || 0
      },
      products: productCounts,
      inventory: {
        lowStockCount,
        outOfStockCount
      },
      trust: {
        averageRating: reviewAgg._avg.rating ? Number(reviewAgg._avg.rating.toFixed(2)) : 0,
        totalReviews: reviewAgg._count.rating
      },
      recentOrders: topRecentOrders
    };
  }
}
