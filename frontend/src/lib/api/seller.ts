import { apiClient } from './client';
import { ApiResponse } from '@/types/auth';
import { ProducerProfile, SellerDashboardSummary } from '@/types/seller';
import { Product, PaginatedResponse, Inventory } from '@/types/product';
import { SellerOrder } from '@/types/order';

export const sellerApi = {
  // --- DASHBOARD ---
  getDashboardSummary: async (timeframe: string = '30d') => {
    return apiClient<ApiResponse<SellerDashboardSummary>>(`/seller/dashboard/summary?timeframe=${timeframe}`);
  },

  // --- PRODUCER PROFILE ---
  getProducerProfile: async () => {
    return apiClient<ApiResponse<ProducerProfile>>('/producers/me');
  },

  // --- CATALOG & PRODUCTS ---
  getProducts: async (params?: Record<string, string | number>) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiClient<PaginatedResponse<Product>>(`/products/me/catalog${query ? `?${query}` : ''}`);
  },

  createProduct: async (data: any) => {
    return apiClient<ApiResponse<Product>>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateProduct: async (id: string, data: any) => {
    return apiClient<ApiResponse<Product>>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // --- INVENTORY ---
  updateInventory: async (variantId: string, data: { adjustmentQuantity: number; type: string; notes?: string }) => {
    return apiClient<ApiResponse<Inventory>>(`/inventory/${variantId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // --- ORDERS ---
  getSellerOrders: async (params?: Record<string, string | number>) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiClient<PaginatedResponse<SellerOrder>>(`/seller/orders${query ? `?${query}` : ''}`);
  },

  getSellerOrderDetails: async (id: string) => {
    return apiClient<ApiResponse<SellerOrder>>(`/seller/orders/${id}`);
  },

  updateOrderStatus: async (id: string, status: string) => {
    return apiClient<ApiResponse<SellerOrder>>(`/seller/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
};
