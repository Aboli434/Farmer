import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { OrderStatus, ReviewStatus } from '@prisma/client';

export class ReviewService {
  /**
   * Create a new review for an OrderItem.
   * Ensures the item belongs to the user, the seller order is DELIVERED, and no previous review exists.
   */
  static async createReview(userId: string, orderItemId: string, rating: number, comment?: string) {
    // 1. Fetch the OrderItem and its associated SellerOrder
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        sellerOrder: {
          include: {
            order: true
          }
        },
        variant: true
      }
    });

    if (!orderItem) {
      throw new ApiError(404, 'NOT_FOUND', 'Order item not found');
    }

    if (orderItem.sellerOrder.order.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You did not purchase this item');
    }

    if (orderItem.sellerOrder.status !== OrderStatus.DELIVERED) {
      throw new ApiError(400, 'BAD_REQUEST', 'You can only review delivered items');
    }

    // 2. Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: { orderItemId }
    });

    if (existingReview) {
      throw new ApiError(409, 'CONFLICT', 'You have already reviewed this item');
    }

    // 3. Derive productId from variant
    const productId = orderItem.variant.productId;

    // 4. Create Review
    const review = await prisma.review.create({
      data: {
        userId,
        productId,
        orderItemId,
        rating,
        comment,
        status: ReviewStatus.VISIBLE
      }
    });

    return review;
  }

  /**
   * Update an existing review (rating and/comment only).
   */
  static async updateReview(userId: string, reviewId: string, rating?: number, comment?: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review || review.deletedAt) {
      throw new ApiError(404, 'NOT_FOUND', 'Review not found');
    }

    if (review.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this review');
    }

    const dataToUpdate: any = {};
    if (rating !== undefined) dataToUpdate.rating = rating;
    if (comment !== undefined) dataToUpdate.comment = comment;

    return await prisma.review.update({
      where: { id: reviewId },
      data: dataToUpdate
    });
  }

  /**
   * Soft delete a review.
   */
  static async deleteReview(userId: string, reviewId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review || review.deletedAt) {
      throw new ApiError(404, 'NOT_FOUND', 'Review not found');
    }

    if (review.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this review');
    }

    return await prisma.review.update({
      where: { id: reviewId },
      data: { deletedAt: new Date() }
    });
  }

  /**
   * Report a review.
   */
  static async reportReview(userId: string, reviewId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId }
    });

    if (!review || review.deletedAt) {
      throw new ApiError(404, 'NOT_FOUND', 'Review not found');
    }

    // Customers and sellers can report.
    // If it's already hidden, we don't need to change it.
    if (review.status === ReviewStatus.HIDDEN) {
      return review;
    }

    return await prisma.review.update({
      where: { id: reviewId },
      data: { status: ReviewStatus.FLAGGED }
    });
  }
}
