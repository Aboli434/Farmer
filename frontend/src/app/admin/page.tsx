'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api/admin';
import { AdminDashboardSummary, OperationalAlerts } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Package, ShoppingCart, DollarSign, AlertCircle, AlertTriangle, ChevronRight, XCircle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<OperationalAlerts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [summaryRes, alertsRes] = await Promise.all([
        adminApi.getDashboardSummary(),
        adminApi.getOperationalAlerts()
      ]);

      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data as AdminDashboardSummary);
      }
      if (alertsRes.success && alertsRes.data) {
        setAlerts(alertsRes.data as OperationalAlerts);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-14 bg-slate-100" />
              <CardContent className="h-20 bg-slate-50" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg text-center">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-500" />
        <h3 className="text-lg font-medium">Error Loading Dashboard</h3>
        <p className="mt-1">{error}</p>
        <Button onClick={fetchData} variant="outline" className="mt-4">Try Again</Button>
      </div>
    );
  }

  const hasAlerts = alerts && (
    alerts.stuckOrders.length > 0 || 
    alerts.flaggedReviews.length > 0 || 
    alerts.failedPayments.length > 0 || 
    alerts.failedRefunds.length > 0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Marketplace key performance indicators and operational alerts.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Total Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">₹{summary?.financials.netDeliveredRevenue}</div>
            <p className="text-xs text-slate-500 mt-1">Net delivered revenue</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Orders</CardTitle>
            <ShoppingCart className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.orders.totalOrders}</div>
            <p className="text-xs text-slate-500 mt-1">{summary?.orders.deliveredOrders} delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Products</CardTitle>
            <Package className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.products.activeProducts}</div>
            <p className="text-xs text-orange-600 mt-1 font-medium">{summary?.products.pendingProducts} pending approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Active Users</CardTitle>
            <Users className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.users.customers}</div>
            <p className="text-xs text-slate-500 mt-1">{summary?.users.approvedProducers} approved producers</p>
          </CardContent>
        </Card>
      </div>

      {/* Operational Alerts */}
      <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-orange-500" /> Operational Alerts
      </h2>

      {!hasAlerts ? (
        <Card className="bg-slate-50/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <p className="font-medium text-slate-900">All clear!</p>
            <p className="text-sm">No operational issues requiring attention.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Stuck Orders */}
          {alerts!.stuckOrders.length > 0 && (
            <Card className="border-orange-200 shadow-sm">
              <CardHeader className="bg-orange-50/50 border-b border-orange-100 pb-3">
                <CardTitle className="text-base text-orange-800 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Stuck Orders ({alerts!.stuckOrders.length})
                </CardTitle>
                <CardDescription className="text-orange-600/80">Confirmed but not processed in 48 hours</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {alerts!.stuckOrders.map(order => (
                    <div key={order.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-medium text-sm text-slate-900">Order #{order.id.slice(-6).toUpperCase()}</div>
                        <div className="text-xs text-slate-500">{order.producer?.farmName || 'Unknown Farm'}</div>
                      </div>
                      <Link href={`/admin/orders/${order.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          View <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Flagged Reviews */}
          {alerts!.flaggedReviews.length > 0 && (
            <Card className="border-red-200 shadow-sm">
              <CardHeader className="bg-red-50/50 border-b border-red-100 pb-3">
                <CardTitle className="text-base text-red-800 flex items-center gap-2">
                  <Star className="w-4 h-4" /> Flagged Reviews ({alerts!.flaggedReviews.length})
                </CardTitle>
                <CardDescription className="text-red-600/80">User reviews reported for moderation</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {alerts!.flaggedReviews.map(review => (
                    <div key={review.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-medium text-sm text-slate-900 line-clamp-1">{review.product?.name}</div>
                        <div className="text-xs text-slate-500 line-clamp-1">"{review.comment}"</div>
                      </div>
                      <Link href={`/admin/reviews`}>
                        <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 shrink-0">
                          Moderate <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Failed Payments & Refunds */}
          {(alerts!.failedPayments.length > 0 || alerts!.failedRefunds.length > 0) && (
            <Card className="border-red-200 shadow-sm lg:col-span-2">
              <CardHeader className="bg-red-50/50 border-b border-red-100 pb-3">
                <CardTitle className="text-base text-red-800 flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> Payment & Refund Failures
                </CardTitle>
                <CardDescription className="text-red-600/80">Requires manual reconciliation</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {alerts!.failedRefunds.map(refund => (
                    <div key={refund.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-medium text-sm text-slate-900">Failed Refund: ₹{refund.amount}</div>
                        <div className="text-xs text-slate-500">Order #{refund.sellerOrderId.slice(-6).toUpperCase()}</div>
                      </div>
                      <Link href={`/admin/orders/${refund.sellerOrderId}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          Investigate <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                  {alerts!.failedPayments.map(payment => (
                    <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-medium text-sm text-slate-900">Failed Payment: ₹{payment.amount}</div>
                        <div className="text-xs text-slate-500">Reference: {payment.id}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      )}
    </div>
  );
}
