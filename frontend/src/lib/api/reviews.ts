import { apiClient } from './client';
import { CreateReviewRequest, EligibleReviewItem, Review, UpdateReviewRequest } from '@/types/review';

export const reviewsApi = {
  getEligibleItems: async () => {
    return apiClient<{ success: boolean; data: EligibleReviewItem[] }>('/orders/reviewable-items', {
      method: 'GET',
      requireAuth: true,
    });
  },

  createReview: async (data: CreateReviewRequest) => {
    return apiClient<{ success: boolean; data: Review }>('/reviews', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify(data),
    });
  },

  updateReview: async (id: string, data: UpdateReviewRequest) => {
    return apiClient<{ success: boolean; data: Review }>(`/reviews/${id}`, {
      method: 'PATCH',
      requireAuth: true,
      body: JSON.stringify(data),
    });
  },

  deleteReview: async (id: string) => {
    return apiClient<{ success: boolean; message: string }>(`/reviews/${id}`, {
      method: 'DELETE',
      requireAuth: true,
    });
  },

  reportReview: async (id: string) => {
    return apiClient<{ success: boolean; data: unknown }>(`/reviews/${id}/report`, {
      method: 'POST',
      requireAuth: true,
    });
  },

  getProductReviews: async (productId: string, page = 1, limit = 10) => {
    return apiClient<{ success: boolean; data: Review[]; pagination: { total: number; page: number; pages: number } }>(`/products/${productId}/reviews?page=${page}&limit=${limit}`, {
      method: 'GET',
    });
  },
};
