'use client';

import { useEffect, useState, useCallback } from 'react';
import { sellerApi } from '@/lib/api/seller';
import { SellerOrder } from '@/types/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ListOrdered, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await sellerApi.getSellerOrders({ limit: 100 });
      if (res.success && res.data) {
        setOrders(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PENDING': return 'secondary';
      case 'CONFIRMED': return 'default';
      case 'PREPARING': return 'warning';
      case 'READY': return 'success'; // Usually a custom color
      case 'OUT_FOR_DELIVERY': return 'default';
      case 'DELIVERED': return 'success';
      case 'CANCELLED': 
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (order.items || []).some(i => i.productNameSnapshot.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (activeTab === 'ALL') return matchesSearch;
    if (activeTab === 'ACTIVE') {
      return ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(order.status) && matchesSearch;
    }
    if (activeTab === 'COMPLETED') {
      return ['DELIVERED'].includes(order.status) && matchesSearch;
    }
    if (activeTab === 'CANCELLED') {
      return ['CANCELLED', 'REJECTED'].includes(order.status) && matchesSearch;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">Manage and fulfill your customer orders.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab(tab)}
                  className={activeTab === tab ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  {tab.charAt(0) + tab.slice(1).toLowerCase()}
                </Button>
              ))}
            </div>
            <div className="relative w-full max-w-sm ml-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Search orders..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600 bg-red-50">{error}</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <ListOrdered className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No orders found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery ? "No orders match your search." : "You don't have any orders yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 bg-gray-50 uppercase border-b">
                  <tr>
                    <th className="px-6 py-3">Order ID & Date</th>
                    <th className="px-6 py-3">Items</th>
                    <th className="px-6 py-3">Total Amount</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">#{order.id.slice(0, 8).toUpperCase()}</div>
                        <div className="text-xs text-gray-500 mt-1">{new Date(order.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        <div className="line-clamp-1 max-w-[200px]">
                          {(order.items || []).map(i => `${i.quantity}x ${i.productNameSnapshot}`).join(', ')}
                        </div>
                        <div className="text-xs mt-1 text-gray-400">{(order.items || []).length} item(s)</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        ₹{order.totalAmount}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusBadgeVariant(order.status) as any} className={order.status === 'READY' || order.status === 'DELIVERED' ? 'bg-green-100 text-green-800 border-none' : ''}>
                          {order.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/seller/orders/${order.id}`}>
                          <Button variant="outline" size="sm">
                            View <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
