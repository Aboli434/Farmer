export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string;
  createdAt: string;
  admin?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface DashboardMetrics {
  totalUsers: number;
  totalProducers: number;
  pendingVerifications: number;
  activeProducts: number;
  totalOrders: number;
  totalRevenue: number;
  recentOrders: Record<string, unknown>[];
}
