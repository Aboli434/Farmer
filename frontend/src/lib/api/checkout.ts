import { apiClient } from './client';
import { CheckoutRequest, CheckoutResponse } from '@/types/checkout';

export const checkoutApi = {
  initiateCheckout: async (data: CheckoutRequest) => {
    return apiClient<{ success: boolean; data: CheckoutResponse }>('/checkout/initiate', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify(data),
    });
  },
};
