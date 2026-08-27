import { apiClient } from './client';
import { Product, PaginatedResponse } from '@/types/product';

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  producerId?: string;
  status?: string;
  search?: string;
  productType?: string;
  minPrice?: number;
  maxPrice?: number;
  pincode?: string;
  city?: string;
  district?: string;
  sort?: 'RELEVANCE' | 'PRICE_LOW_TO_HIGH' | 'PRICE_HIGH_TO_LOW' | 'NEWEST';
}

export const productsApi = {
  getProducts: async (params: ProductQueryParams = {}) => {
    // Build query string
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    
    const queryString = searchParams.toString();
    const endpoint = `/products${queryString ? `?${queryString}` : ''}`;
    
    return apiClient<PaginatedResponse<Product>>(endpoint, {
      method: 'GET',
      requireAuth: false, // Public discovery
    });
  },

  getProductBySlug: async (slug: string) => {
    return apiClient<{ success: boolean; data: Product }>(`/products/${slug}`, {
      method: 'GET',
      requireAuth: false, // Public discovery
    });
  },
};
