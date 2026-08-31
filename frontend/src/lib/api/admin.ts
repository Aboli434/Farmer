import { apiClient } from './client';
import { 
  AdminDashboardSummary, 
  OperationalAlerts, 
  ProducerVerificationDetails,
  ReviewModerationItem,
  AdminActionLog,
  PaginatedResponse 
} from '@/types/admin';
import { Product } from '@/types/product';
import { SellerOrder } from '@/types/order';

// We need to return ApiResponse wrappers where the backend uses it. Wait, the backend uses { success: true, data: T } for simple responses.
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const adminApi = {
  // Dashboard
  getDashboardSummary: async () => 
    apiClient<ApiResponse<AdminDashboardSummary>>('/admin/dashboard/summary'),
    
  getOperationalAlerts: async () => 
    apiClient<ApiResponse<OperationalAlerts>>('/admin/dashboard/alerts'),

  // Verifications & Producers
  getVerifications: async (params?: Record<string, string | number>) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiClient<PaginatedResponse<ProducerVerificationDetails>>(`/admin/verifications${query ? `?${query}` : ''}`);
  },
    
  getVerificationById: async (id: string) => 
    apiClient<ApiResponse<ProducerVerificationDetails>>(`/admin/verifications/${id}`),

  approveProducer: async (id: string) => 
    apiClient<{ success: boolean; message: string; data: any }>(`/admin/verifications/${id}/approve`, {
      method: 'POST'
    }),

  rejectProducer: async (id: string, reason: string) => 
    apiClient<{ success: boolean; message: string; data: any }>(`/admin/verifications/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  suspendProducer: async (id: string, reason: string) => 
    apiClient<{ success: boolean; message: string; data: any }>(`/admin/producers/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  // Products
  getProducts: async (params?: Record<string, string | number>) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiClient<PaginatedResponse<Product>>(`/admin/products${query ? `?${query}` : ''}`);
  },

  approveProduct: async (id: string) => 
    apiClient<{ success: boolean; message: string; data: any }>(`/admin/products/${id}/approve`, {
      method: 'POST'
    }),

  rejectProduct: async (id: string, reason: string) => 
    apiClient<{ success: boolean; message: string; data: any }>(`/admin/products/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  // Reviews
  getModerationQueue: async (params?: Record<string, string | number>) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    // admin review controller uses { success: true, ...queue } -> pagination and data
    return apiClient<PaginatedResponse<ReviewModerationItem>>(`/admin/reviews${query ? `?${query}` : ''}`);
  },

  moderateReview: async (id: string, status: 'VISIBLE' | 'HIDDEN' | 'FLAGGED') => 
    apiClient<ApiResponse<ReviewModerationItem>>(`/admin/reviews/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  // Orders
  getOrders: async (params?: Record<string, string | number>) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiClient<PaginatedResponse<SellerOrder>>(`/admin/orders${query ? `?${query}` : ''}`);
  },

  forceCancelOrder: async (id: string, reason: string) => 
    apiClient<{ success: boolean; message: string; data: any }>(`/admin/orders/${id}/force-cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  // Audit Logs
  getAuditLogs: async (params?: Record<string, string | number>) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiClient<PaginatedResponse<AdminActionLog>>(`/admin/audit-logs${query ? `?${query}` : ''}`);
  },
};
