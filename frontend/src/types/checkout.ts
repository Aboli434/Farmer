export interface CheckoutRequest {
  addressId: string;
  idempotencyKey: string;
}

export interface CheckoutResponse {
  payment: {
    id: string;
    orderId: string;
    provider: string;
    providerOrderId: string;
    amount: number;
    status: string;
  };
  providerOrderId: string;
  razorpayOrderAmount: number;
  razorpayOrderCurrency: string;
}
