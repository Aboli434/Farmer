import { ProducerProfile } from './seller';
import { SellerOrder } from './order';
import { User } from './auth';

export interface PaginationMeta {
  total: number;
  pages: number;
  page: number;
  limit: number;
}

export interface AdminDashboardSummary {
  users: {
    customers: number;
    approvedProducers: number;
    suspendedProducers: number;
  };
  products: {
    activeProducts: number;
    pendingProducts: number;
  };
  orders: {
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    rejectedOrders: number;
  };
  financials: {
    grossDeliveredRevenue: string | number;
    processedRefunds: string | number;
    netDeliveredRevenue: string | number;
    failedPaymentsCount: number;
    pendingRefundsCount: number;
  };
}

export interface OperationalAlerts {
  stuckOrders: Array<SellerOrder & { producer?: { farmName: string } }>;
  flaggedReviews: Array<ReviewModerationItem>;
  failedRefunds: Array<{ id: string; paymentId: string; sellerOrderId: string; amount: number; payment?: { providerOrderId: string | null } }>;
  failedPayments: Array<{ id: string; orderId: string; amount: number }>;
}

export interface ProducerVerificationDetails {
  id: string;
  producerId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  documents: any;
  rejectionReason: string | null;
  reviewedById: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  producer?: ProducerProfile;
  reviewedBy?: User;
}

export interface ReviewModerationItem {
  id: string;
  userId: string;
  productId: string;
  orderItemId: string;
  rating: number;
  comment: string | null;
  status: 'VISIBLE' | 'HIDDEN' | 'FLAGGED';
  createdAt: string;
  updatedAt: string;
  product?: { name: string };
  user?: { name: string; phone: string };
}

export interface AdminActionLog {
  id: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: any;
  newValue: any;
  reason: string | null;
  createdAt: string;
  admin?: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination?: PaginationMeta;
  success: boolean;
}
