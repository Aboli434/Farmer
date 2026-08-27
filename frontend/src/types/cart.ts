import { ProductVariant } from './product';

export type CartStatus = 'ACTIVE' | 'CONVERTED' | 'ABANDONED';

export interface CartItem {
  id: string;
  cartId: string;
  variantId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  variant?: ProductVariant & { product: { name: string; images: { url: string }[] } };
}

export interface Cart {
  id: string;
  userId: string;
  status: CartStatus;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}
