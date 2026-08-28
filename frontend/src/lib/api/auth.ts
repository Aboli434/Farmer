import { apiClient } from './client';
import { User, ApiResponse } from '@/types/auth';

export const authApi = {
  sendOtp: async (phone: string) => {
    return apiClient<ApiResponse<{ message: string; otp?: string; isNewUser?: boolean }>>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
      requireAuth: false,
    });
  },

  verifyOtp: async (phone: string, otp: string, name?: string) => {
    return apiClient<ApiResponse<{ user: User }>>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, name }),
      requireAuth: false,
    });
  },

  getCurrentUser: async () => {
    return apiClient<ApiResponse<User>>('/auth/me', {
      method: 'GET',
    });
  },
};
