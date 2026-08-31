export type Role = 'CUSTOMER' | 'SELLER' | 'ADMIN' | 'DELIVERY_PARTNER';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface User {
  id: string;
  phone: string;
  email: string | null;
  name: string;
  role: Role;
  status: string; // "ACTIVE", "INACTIVE", "BLOCKED"
  createdAt: string;
  updatedAt: string;
}

// Reusable standard API Response wrapper based on backend conventions
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    status: number;
    message: string;
    details?: any;
  };
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
