import { apiClient } from './client';
import { Address, CreateAddressDto } from '@/types/address';

export const addressApi = {
  getAddresses: async () => {
    return apiClient<{ success: boolean; data: Address[] }>('/address', {
      method: 'GET',
      requireAuth: true,
    });
  },

  createAddress: async (data: CreateAddressDto) => {
    return apiClient<{ success: boolean; data: Address }>('/address', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify(data),
    });
  },
};
