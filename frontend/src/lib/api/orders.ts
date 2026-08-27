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
};
