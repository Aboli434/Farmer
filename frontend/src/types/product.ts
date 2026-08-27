export type ProductStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'REJECTED' | 'INACTIVE';
export type ProductType = 'FRESH_PRODUCE' | 'PROCESSED_FOOD';
export type ProcessingLevel = 'RAW' | 'MINIMALLY_PROCESSED' | 'PROCESSED';

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Inventory {
  id: string;
  variantId: string;
  availableQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  label: string;
  quantity: number;
  unit: string;
  price: number;
  isActive: boolean;
  inventory?: Inventory | null;
}

export interface ProductDetail {
  id: string;
  productId: string;
  isVegetarian: boolean;
  shelfLifeDays?: number;
  ingredients?: string;
  processingLevel?: ProcessingLevel;
  processingDetails?: string;
  allergenInfo?: string;
  productionDate?: string;
  harvestDate?: string;
  bestBeforeDate?: string;
  expiryDate?: string;
  storageInstructions?: string;
  packagingDetails?: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  producerId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  productType: ProductType;
  createdAt: string;
  updatedAt: string;
  
  category?: Category;
  detail?: ProductDetail;
  images?: ProductImage[];
  variants?: ProductVariant[];
  producer?: {
    id: string;
    farmName: string;
    city: string;
    district: string;
    state?: string;
    producerType: string;
    verifications: { status: string }[];
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
