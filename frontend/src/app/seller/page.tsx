'use client';

import { useEffect, useState } from 'react';
import { sellerApi } from '@/lib/api/seller';
import { SellerDashboardSummary, LowStockAlert } from '@/types/seller';
import { Product } from '@/types/product';
import { SellerOrder } from '@/types/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Package, AlertCircle, ShoppingCart, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function SellerDashboardPage() {
  const [summary, setSummary] = useState<SellerDashboardSummary | null>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        // Fetch dashboard summary
        const summaryRes = await sellerApi.getDashboardSummary('30d');
        if (summaryRes.success && summaryRes.data) {
          setSummary(summaryRes.data);
        }

        // Fetch products to calculate low stock alerts locally
        const productsRes = await sellerApi.getProducts({ limit: 100 });
        if (productsRes.success && productsRes.data) {
          const alerts: LowStockAlert[] = [];
          productsRes.data.forEach((product: Product) => {
            product.variants?.forEach(variant => {
              const qty = variant.inventory?.availableQuantity || 0;
              const threshold = variant.inventory?.lowStockThreshold || 5;
              if (qty <= threshold) {
                alerts.push({
                  productName: product.name,
                  variantLabel: variant.label,
                  availableQuantity: qty,
                  lowStockThreshold: threshold,
                  variantId: variant.id,
                  isOutOfStock: qty === 0
                });
              }
            });
          });
          setLowStockAlerts(alerts);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border border-red-200">
        <h2 className="text-lg font-semibold text-red-600">Error</h2>
        <p className="text-gray-600">{error || 'Could not load dashboard'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <span className="text-sm text-gray-500">Last 30 days</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">₹{summary.sales.revenue}</div>
            <p className="text-xs text-gray-500 mt-1">From {summary.sales.successfulOrders} successful orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {summary.orders.confirmed + summary.orders.preparing + summary.orders.ready + summary.orders.outForDelivery}
            </div>
            <p className="text-xs text-gray-500 mt-1">{summary.orders.confirmed} awaiting processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{summary.products.active}</div>
            <p className="text-xs text-gray-500 mt-1">{summary.products.pending} pending approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trust Metric</CardTitle>
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{summary.trust.averageRating}</div>
            <p className="text-xs text-gray-500 mt-1">From {summary.trust.totalReviews} reviews</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.recentOrders && summary.recentOrders.length > 0 ? (
                <div className="space-y-4">
                  {summary.recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-gray-50">
                      <div>
                        <div className="font-medium text-gray-900">Order #{order.id.slice(0, 8).toUpperCase()}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          Amount: <span className="font-semibold text-gray-700">₹{order.totalAmount}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {order.status}
                        </span>
                        <Link href={`/seller/orders/${order.id}`}>
                          <Button variant="outline" size="sm">View Order</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No recent actionable orders.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alerts */}
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Inventory Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockAlerts.length > 0 ? (
                <div className="space-y-4">
                  {lowStockAlerts.map((alert, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${alert.isOutOfStock ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                      <div className="font-medium text-gray-900 text-sm">{alert.productName}</div>
                      <div className="text-xs text-gray-500 mb-2">{alert.variantLabel}</div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${alert.isOutOfStock ? 'text-red-700' : 'text-orange-700'}`}>
                          {alert.isOutOfStock ? 'Out of Stock' : `${alert.availableQuantity} remaining`}
                        </span>
                        <Link href="/seller/inventory">
                          <Button variant="link" size="sm" className="h-auto p-0">Manage</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
                    <Package className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">Inventory looks good!</h3>
                  <p className="text-xs text-gray-500 mt-1">No low stock alerts at the moment.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
