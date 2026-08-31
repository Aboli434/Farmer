'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api/admin';
import { SellerOrder } from '@/types/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PackageX, ChevronRight, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = useCallback(async (currentPage: number, status: string) => {
    try {
      
      const params: any = { page: currentPage, limit: 15 };
      if (status !== 'ALL') {
        params.status = status;
      }
      
      const res = await adminApi.getOrders(params);
      if (res.success && res.data) {
        setOrders(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.pages);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load global orders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(page, statusFilter);
  }, [fetchOrders, page, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'CONFIRMED':
        return <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">{status}</span>;
      case 'PREPARING':
      case 'READY_FOR_PICKUP':
      case 'OUT_FOR_DELIVERY':
        return <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">{status}</span>;
      case 'DELIVERED':
        return <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">{status}</span>;
      case 'CANCELLED':
      case 'REJECTED':
        return <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">{status}</span>;
      default:
        return <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const getPaymentBadge = (status: string | undefined) => {
    if (!status) return <span className="text-gray-400 text-xs">Unknown</span>;
    switch (status) {
      case 'COMPLETED':
        return <span className="text-green-600 font-medium text-xs">Paid</span>;
      case 'PENDING':
        return <span className="text-orange-600 font-medium text-xs">Pending</span>;
      case 'FAILED':
        return <span className="text-red-600 font-medium text-xs">Failed</span>;
      case 'REFUNDED':
        return <span className="text-purple-600 font-medium text-xs">Refunded</span>;
      default:
        return <span className="text-gray-600 font-medium text-xs">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Global Orders</h1>
          <p className="text-sm text-slate-500">Monitor all marketplace orders across all producers.</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Order List</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <Select value={statusFilter} onValueChange={(val: string | null) => { setStatusFilter(val || 'ALL'); setPage(1); }}>
                <SelectTrigger className="bg-white w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Orders</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && orders.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600 bg-red-50">
              {error}
              <Button onClick={() => fetchOrders(page, statusFilter)} variant="outline" className="mt-4 bg-white">Retry</Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
                <PackageX className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No orders found</h3>
              <p className="mt-1 text-sm">There are no orders matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b">
                  <tr>
                    <th className="px-6 py-3">Order ID / Date</th>
                    <th className="px-6 py-3">Producer</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Payment</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="bg-white hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">#{order.id.slice(-8).toUpperCase()}</div>
                        <div className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-700">{(order as any).producer?.farmName || 'Unknown Farm'}</div>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        ₹{Number(order.totalAmount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        {getPaymentBadge((order as any).order?.payment?.status)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/admin/orders/${order.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                            Details <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50">
              <div className="text-sm text-slate-500">
                Page <span className="font-medium text-slate-900">{page}</span> of <span className="font-medium text-slate-900">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
