import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { ReviewStatus } from '@prisma/client';

export class AdminReviewService {
  /**
   * Get the moderation queue of reviews.
   * Prioritizes FLAGGED reviews, then orders by newest.
   */
  static async getModerationQueue(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { deletedAt: null },
        include: {
          user: { select: { name: true, phone: true } },
          product: { select: { name: true } },
          orderItem: { select: { sellerOrderId: true } }
        },
        orderBy: [
          { status: 'desc' }, 
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.review.count({ where: { deletedAt: null } })
    ]);

    reviews.sort((a, b) => {
      if (a.status === ReviewStatus.FLAGGED && b.status !== ReviewStatus.FLAGGED) return -1;
      if (b.status === ReviewStatus.FLAGGED && a.status !== ReviewStatus.FLAGGED) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

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
   * Update the status of a review (e.g. VISIBLE or HIDDEN).
   */
  static async moderateReview(reviewId: string, status: ReviewStatus, adminId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      throw new ApiError(404, 'NOT_FOUND', 'Review not found');
    }

    if (status !== ReviewStatus.VISIBLE && status !== ReviewStatus.HIDDEN) {
      throw new ApiError(400, 'BAD_REQUEST', 'Can only set status to VISIBLE or HIDDEN');
    }

    return await prisma.review.update({
      where: { id: reviewId },
      data: { status }
    });
  }
}
