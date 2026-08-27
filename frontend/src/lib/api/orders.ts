import { apiClient } from './client';
import { Order } from '@/types/order';

export const ordersApi = {
  getOrders: async () => {
    return apiClient<{ success: boolean; data: Order[] }>('/orders', {
      method: 'GET',
      requireAuth: true,
    });
  },

  getOrderDetails: async (id: string) => {
    return apiClient<{ success: boolean; data: Order }>(`/orders/${id}`, {
      method: 'GET',
      requireAuth: true,
    });
  },

  cancelSellerOrder: async (orderId: string, sellerOrderId: string) => {
    return apiClient<{ success: boolean; message: string; data: unknown }>(`/orders/${orderId}/seller-orders/${sellerOrderId}/cancel`, {
      method: 'POST',
      requireAuth: true,
    });
  },

  getReviewableItems: async () => {
    return apiClient<{ success: boolean; data: unknown[] }>('/orders/reviewable-items', {
      method: 'GET',
      requireAuth: true,
    });
  },
};
