'use client';

import { useState, useEffect } from 'react';
import { ordersApi } from '@/lib/api/orders';
import { Order } from '@/types/order';
import { Loader2, Package, ChevronRight, Calendar, Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await ordersApi.getOrders();
        setOrders(response.data);
      } catch (err) {
        console.error('Failed to load orders', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'bg-green-100 text-green-700 hover:bg-green-100';
      case 'CANCELLED': 
      case 'REJECTED': return 'bg-red-100 text-red-700 hover:bg-red-100';
      case 'OUT_FOR_DELIVERY':
      case 'READY': return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
      default: return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'; // PENDING, CONFIRMED, PREPARING
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'text-green-600 bg-green-50';
      case 'FAILED': return 'text-red-600 bg-red-50';
      default: return 'text-yellow-600 bg-yellow-50'; // PENDING
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 shadow-sm">
          <div className="mx-auto h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-900">No orders yet</h3>
          <p className="text-gray-500 mt-2 mb-6">Looks like you haven&apos;t placed any orders.</p>
          <Link href="/customer">
            <span className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-primary-foreground hover:bg-green-700 h-10 px-4 py-2">
              Start Shopping
            </span>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            // Because one master order can have multiple seller orders,
            // we determine the "overall" status by finding the lowest common denominator,
            // but for simplicity in MVP, we can just show the master order's date and total,
            // and maybe list the producers.
            const payment = order.payments?.[0];
            const producers = order.sellerOrders?.map(so => so.producerNameSnapshot).join(', ') || 'Various Producers';
            const totalItems = order.sellerOrders?.reduce((sum, so) => sum + (so.items?.length || 0), 0) || 0;
            
            return (
              <Link href={`/customer/orders/${order.id}`} key={order.id}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer border-gray-200 overflow-hidden mb-6">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-6">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Order Placed</p>
                        <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Total</p>
                        <p className="text-sm font-bold text-gray-900">₹{order.totalAmount.toFixed(2)}</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Order #</p>
                        <p className="text-sm font-mono text-gray-600">{order.id.slice(-8).toUpperCase()}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getPaymentStatusColor(payment?.status || 'PENDING')} border-current/20`}>
                        {payment?.status === 'SUCCESS' ? 'PAID' : payment?.status || 'UNPAID'}
                      </span>
                    </div>
                  </div>
                  
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-1">
                          <Store className="h-4 w-4 text-green-600" />
                          {producers}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {totalItems} {totalItems === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                    
                    {/* Render sub-orders status */}
                    {order.sellerOrders && order.sellerOrders.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {order.sellerOrders.map(so => (
                          <Badge key={so.id} variant="secondary" className={`${getStatusColor(so.status)} border-transparent`}>
                            {so.producerNameSnapshot}: {so.status.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
