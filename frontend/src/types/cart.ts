export type CartStatus = 'ACTIVE' | 'CONVERTED' | 'ABANDONED';

export interface CartGroupedItem {
  id: string;
  variantId: string;
  quantity: number;
  label: string;
  price: number;
  unit: string;
  productName: string;
  availableStock: number;
}

export interface CartProducerGroup {
  producerId: string;
  farmName: string;
  items: CartGroupedItem[];
}

export interface CartResponse {
  cartId: string;
  items: CartItem[]; // We can leave items untyped or loosely typed as it's not heavily used directly in the UI
  groupedByProducer: CartProducerGroup[];
}

export interface CartItem {
  id: string;
  cartId: string;
  variantId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface Cart {
  id: string;
  userId: string;
  status: CartStatus;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}
