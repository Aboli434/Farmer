'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sellerApi } from '@/lib/api/seller';
import { SellerOrder } from '@/types/order';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Package, User, MapPin, Truck, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function SellerOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  
  const [order, setOrder] = useState<SellerOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrder();
  }, [orderId]);

  async function fetchOrder() {
    try {
      
      const res = await sellerApi.getSellerOrderDetails(orderId);
      if (res.success && res.data) {
        setOrder(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load order details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      setIsUpdating(true);
      const res = await sellerApi.updateOrderStatus(orderId, newStatus);
      if (res.success && res.data) {
        setOrder(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PENDING': return 'secondary';
      case 'CONFIRMED': return 'default';
      case 'PREPARING': return 'warning';
      case 'READY': return 'success';
      case 'OUT_FOR_DELIVERY': return 'default';
      case 'DELIVERED': return 'success';
      case 'CANCELLED': 
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border border-red-200 text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-red-600">Order Not Found</h2>
        <p className="text-gray-600 mb-6">{error || 'Could not load the requested order'}</p>
        <Link href="/seller/orders">
          <Button variant="outline">Return to Orders</Button>
        </Link>
      </div>
    );
  }

  // Define allowed transitions (simplified)
  const availableActions = () => {
    switch(order.status) {
      case 'CONFIRMED':
      case 'PENDING':
        return (
          <>
            <Button 
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
              onClick={() => handleStatusUpdate('ACCEPTED')}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Accept Order
            </Button>
            <Button 
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={() => handleStatusUpdate('REJECTED')}
              disabled={isUpdating}
            >
              Reject Order
            </Button>
          </>
        );
      case 'ACCEPTED':
        return (
          <Button 
            className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
            onClick={() => handleStatusUpdate('PREPARING')}
            disabled={isUpdating}
          >
            Start Preparing
          </Button>
        );
      case 'PREPARING':
        return (
          <Button 
            className="bg-yellow-500 hover:bg-yellow-600 text-white w-full sm:w-auto"
            onClick={() => handleStatusUpdate('READY')}
            disabled={isUpdating}
          >
            Mark as Ready
          </Button>
        );
      case 'READY':
        return (
          <Button 
            className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto"
            onClick={() => handleStatusUpdate('OUT_FOR_DELIVERY')}
            disabled={isUpdating}
          >
            <Truck className="h-4 w-4 mr-2" /> Out for Delivery
          </Button>
        );
      case 'OUT_FOR_DELIVERY':
        return (
          <Button 
            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
            onClick={() => handleStatusUpdate('DELIVERED')}
            disabled={isUpdating}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Delivered
          </Button>
        );
      default:
        return null; // Terminal states (DELIVERED, CANCELLED, REJECTED)
    }
  };

  // Try to parse shipping address (it&apos;s a JSON snapshot)
  let address = null;
  if (order.order?.shippingAddressSnapshot) {
    try {
      address = typeof order.order.shippingAddressSnapshot === 'string' 
        ? JSON.parse(order.order.shippingAddressSnapshot) 
        : order.order.shippingAddressSnapshot;
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/seller/orders">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-sm text-gray-500">Placed on {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="ml-auto">
          <Badge variant={getStatusBadgeVariant(order.status) as any} className="text-sm px-3 py-1">
            {order.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Order Items */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Package className="h-5 w-5 mr-2 text-gray-500" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-gray-100">
                {(order.items || []).map((item) => (
                  <li key={item.id} className="py-4 flex justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{item.productNameSnapshot}</p>
                      <p className="text-sm text-gray-500">
                        {item.variantLabelSnapshot} • ₹{item.unitPrice} / {item.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">₹{item.totalPrice}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="bg-gray-50 border-t flex flex-col items-end py-4">
              <div className="w-full max-w-xs space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{order.subtotal}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery Fee</span>
                  <span>₹{order.deliveryFee}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t mt-2">
                  <span>Total Amount</span>
                  <span>₹{order.totalAmount}</span>
                </div>
              </div>
            </CardFooter>
          </Card>

          {/* Action Bar */}
          {availableActions() && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6">
                <h3 className="font-medium text-green-900 mb-4">Update Order Status</h3>
                <div className="flex flex-wrap gap-3">
                  {availableActions()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Customer Info & Timeline */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <User className="h-5 w-5 mr-2 text-gray-500" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1 flex items-center">
                  <MapPin className="h-4 w-4 mr-1" /> Delivery Address
                </p>
                {address ? (
                  <div className="text-gray-900 font-medium">
                    <p>{address.fullName}</p>
                    <p>{address.phone}</p>
                    <p className="mt-1 font-normal text-gray-600">
                      {address.address}
                      {address.landmark && `, near ${address.landmark}`}
                      <br />
                      {address.city}, {address.district}
                      <br />
                      {address.state} - {address.pincode}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Address not available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
