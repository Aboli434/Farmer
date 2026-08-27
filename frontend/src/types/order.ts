import { ProductVariant } from './product';
import { ProducerProfile } from './seller';
import { User } from './auth';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'ACCEPTED' | 'REJECTED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type RefundStatus = 'PENDING' | 'PROCESSED' | 'FAILED';
export type SettlementStatus = 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED';
export type DeliveryMethod = 'SELF_DELIVERY' | 'PLATFORM_DELIVERY';

export interface OrderItem {
  id: string;
  sellerOrderId: string;
  variantId: string;
  productNameSnapshot: string;
  variantLabelSnapshot: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  taxAmount: number;
  variant?: ProductVariant;
}

export interface Payment {
  id: string;
  orderId: string;
  provider: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt?: string;
  createdAt: string;
}

export interface SellerOrder {
  id: string;
  orderId: string;
  producerId: string;
  producerNameSnapshot: string;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  
  items?: OrderItem[];
  producer?: ProducerProfile;
  order?: Order;
}

export interface Order {
  id: string;
  userId: string;
  shippingAddressSnapshot: Record<string, unknown> | null;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  
  user?: User;
  sellerOrders?: SellerOrder[];
  payments?: Payment[];
}
