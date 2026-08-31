import { VerificationStatus } from './auth';
import { SellerOrder } from './order';

export type ProducerType = 'FARMER' | 'HOME_PRODUCER' | 'ARTISAN_PRODUCER' | 'FARM_COOPERATIVE' | 'OTHER';

export interface ProducerProfile {
  id: string;
  userId: string;
  producerType: ProducerType;
  farmName: string;
  story: string;
  addressLine?: string;
  pincode: string;
  district: string;
  city: string;
  state: string;
  fssaiNumber?: string;
  latitude?: number;
  longitude?: number;
  serviceRadius: number; // km
  createdAt: string;
  updatedAt: string;
}

export interface ProducerVerification {
  id: string;
  producerId: string;
  status: VerificationStatus;
  documents: any;
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
}

export interface SellerDashboardSummary {
  timeframe: string;
  sales: {
    revenue: string;
    successfulOrders: number;
  };
  orders: {
    confirmed: number;
    accepted: number;
    preparing: number;
    ready: number;
    outForDelivery: number;
    delivered: number;
    cancelled: number;
    rejected: number;
  };
  products: {
    active: number;
    pending: number;
    rejected: number;
    inactive: number;
    draft: number;
  };
  inventory: {
    lowStockCount: number;
    outOfStockCount: number;
  };
  trust: {
    averageRating: number;
    totalReviews: number;
  };
  recentOrders: SellerOrder[];
}

export interface LowStockAlert {
  productName: string;
  variantLabel: string;
  availableQuantity: number;
  lowStockThreshold: number;
  variantId: string;
  isOutOfStock: boolean;
}
