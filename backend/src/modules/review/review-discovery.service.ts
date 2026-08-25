import { prisma } from '../../config/prisma';
import { ReviewStatus } from '@prisma/client';

export class ReviewDiscoveryService {
  /**
   * Fetch paginated visible reviews for a product.
   */
  static async getProductReviews(productId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          productId,
          status: ReviewStatus.VISIBLE,
          deletedAt: null
        },
        include: {
          user: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.review.count({
        where: {
          productId,
          status: ReviewStatus.VISIBLE,
          deletedAt: null
        }
      })
    ]);

    return {
      data: reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Aggregate average rating and total reviews for a product.
   */
  static async getProductAggregateRating(productId: string) {
    const agg = await prisma.review.aggregate({
      where: {
        productId,
        status: ReviewStatus.VISIBLE,
        deletedAt: null
      },
      _avg: { rating: true },
      _count: { rating: true }
    });

    return {
      averageRating: agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : 0,
      totalReviews: agg._count.rating
    };
  }
}
