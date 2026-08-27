import { apiClient } from './client';
import { CartResponse } from '@/types/cart';

export const cartApi = {
  getCart: async () => {
    return apiClient<{ success: boolean; data: CartResponse }>('/cart', {
      method: 'GET',
      requireAuth: true,
    });
  },

  upsertItem: async (variantId: string, quantity: number) => {
    return apiClient<{ success: boolean; data: CartResponse }>('/cart/items', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify({ variantId, quantity }),
    });
  },

  removeItem: async (variantId: string) => {
    return apiClient<{ success: boolean; data: CartResponse }>(`/cart/items/${variantId}`, {
      method: 'DELETE',
      requireAuth: true,
    });
  },

  clearCart: async () => {
    return apiClient<{ success: boolean; data: CartResponse }>('/cart', {
      method: 'DELETE',
      requireAuth: true,
    });
  },
};
