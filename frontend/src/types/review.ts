export interface Review {
  id: string;
  orderItemId: string;
  userId: string;
  productId: string;
  rating: number;
  comment?: string | null;
  status: 'PUBLISHED' | 'HIDDEN' | 'FLAGGED';
  createdAt: string;
  updatedAt: string;
  
  // Might include nested relations depending on the endpoint
  user?: {
    id: string;
    name: string | null;
  };
}

export interface EligibleReviewItem {
  orderItemId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  canReview: boolean;
  hasReviewed: boolean;
  reviewId?: string;
}

export interface ReviewAggregate {
  averageRating: number;
  totalReviews: number;
  distribution?: Record<number, number>;
}

export interface CreateReviewRequest {
  orderItemId: string;
  rating: number;
  comment?: string;
}

export interface UpdateReviewRequest {
  rating: number;
  comment?: string;
}
