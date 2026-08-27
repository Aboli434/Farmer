'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ordersApi } from '@/lib/api/orders';
import { Order } from '@/types/order';
import { Loader2, ArrowLeft, Package, MapPin, CheckCircle2, Clock, AlertCircle, Calendar, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ReviewForm } from '@/components/customer/ReviewForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { OrderStatusTimeline } from '@/components/customer/OrderStatusTimeline';

export default function OrderDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params.id as string;
  const paymentStatusParam = searchParams.get('payment_status');
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewItemId, setReviewItemId] = useState<string | null>(null);
  const [reviewProductName, setReviewProductName] = useState<string>('');

  const fetchOrder = useCallback(async () => {
    try {
      const response = await ordersApi.getOrderDetails(orderId as string);
      setOrder(response.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load order details');
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchOrder();
    }
    
    // If we just came from Razorpay checkout, we might want to poll for a few seconds
    // to see if the webhook changed the payment status to SUCCESS
    if (paymentStatusParam === 'processing') {
      let attempts = 0;
      const maxAttempts = 10;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(interval);
          return;
        }
        try {
          const res = await ordersApi.getOrderDetails(orderId);
          if (res.data.payments?.[0]?.status === 'SUCCESS' || res.data.payments?.[0]?.status === 'FAILED') {
            setOrder(res.data);
            clearInterval(interval);
          }
        } catch {
          // ignore
        }
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [orderId, paymentStatusParam]);

  const handleCancelOrder = async (sellerOrderId: string) => {
    if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) return;
    
    try {
      setIsLoading(true);
      await ordersApi.cancelSellerOrder(orderId, sellerOrderId);
      await fetchOrder();
    } catch (err) {
      alert('Failed to cancel order. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
        <h3 className="text-lg font-medium text-gray-900">{error || 'Order not found'}</h3>
        <p className="text-gray-500 mt-1">The order you are looking for does not exist or you do not have permission to view it.</p>
        <Link href="/customer/orders">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  const payment = order.payments?.[0];
  const address = order.shippingAddressSnapshot as Record<string, string>;

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <Link href="/customer/orders" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-green-700 mb-6 transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Orders
      </Link>
      
      {paymentStatusParam === 'processing' && payment?.status === 'PENDING' && (
        <div className="mb-6 p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-200 flex items-start gap-3">
          <Loader2 className="h-5 w-5 animate-spin mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold">Payment Processing</h4>
            <p className="text-sm mt-1">We are verifying your payment with the provider. This page will update automatically once confirmed.</p>
          </div>
        </div>
      )}

      {payment?.status === 'SUCCESS' && paymentStatusParam === 'processing' && (
        <div className="mb-6 p-4 bg-green-50 text-green-800 rounded-lg border border-green-200 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-600" />
          <div>
            <h4 className="font-semibold">Payment Successful</h4>
            <p className="text-sm mt-1">Your order has been confirmed and the producers have been notified.</p>
          </div>
        </div>
      )}

      {payment?.status === 'FAILED' && (
        <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-lg border border-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
          <div>
            <h4 className="font-semibold">Payment Failed</h4>
            <p className="text-sm mt-1">We could not process your payment. The order has been cancelled.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Order Details</h1>
          <p className="text-sm text-gray-500 font-mono mt-1">Order #{order.id.split('-')[0].toUpperCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`px-3 py-1.5 text-sm font-medium ${
            payment?.status === 'SUCCESS' ? 'border-green-200 bg-green-50 text-green-700' :
            payment?.status === 'FAILED' ? 'border-red-200 bg-red-50 text-red-700' :
            'border-yellow-200 bg-yellow-50 text-yellow-700'
          }`}>
            Payment: {payment?.status || 'UNKNOWN'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b pb-3 pt-4">
            <CardTitle className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" /> Order Date
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-gray-900 font-medium">
              {new Date(order.createdAt).toLocaleDateString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(order.createdAt).toLocaleTimeString('en-IN')}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200 md:col-span-2">
          <CardHeader className="bg-gray-50 border-b pb-3 pt-4">
            <CardTitle className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" /> Pickup/Billing Address
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {address ? (
              <div className="text-sm text-gray-800">
                <p className="font-medium text-gray-900 mb-1">{address.fullName} <span className="ml-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{address.type}</span></p>
                <p>{address.addressLine1}</p>
                <p>{address.city}, {address.state} {address.pincode}</p>
                <p className="mt-2 text-gray-600 flex items-center gap-2"><Clock className="h-3 w-3" /> Pickup instructions will be provided by producers.</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No address details available</p>
            )}
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-4">Items Ordered</h2>
      <div className="space-y-6">
        {order.sellerOrders?.map((sellerOrder) => (
          <Card key={sellerOrder.id} className="shadow-sm border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b flex flex-wrap justify-between items-center gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{sellerOrder.producerNameSnapshot}</h3>
                  <p className="text-sm text-gray-500">Sub-order #{sellerOrder.id.split('-')[0].toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`
                    ${sellerOrder.status === 'DELIVERED' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                      sellerOrder.status === 'CANCELLED' ? 'bg-red-100 text-red-800 hover:bg-red-100' :
                      'bg-blue-100 text-blue-800 hover:bg-blue-100'}
                    border-transparent px-3 py-1 text-sm
                  `}>
                    {sellerOrder.status.replace(/_/g, ' ')}
                  </Badge>
                  {sellerOrder.status === 'CONFIRMED' && (
                    <Button variant="outline" size="sm" onClick={() => handleCancelOrder(sellerOrder.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                      Cancel Order
                    </Button>
                  )}
                </div>
              </div>
              
              <OrderStatusTimeline status={sellerOrder.status} />
            </div>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-100">
                {sellerOrder.items?.map((item) => (
                  <li key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                        <Package className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{item.productNameSnapshot}</h4>
                        <p className="text-sm text-gray-500">{item.variantLabelSnapshot} • ₹{item.unitPrice} / {item.unit}</p>
                      </div>
                    </div>
                    <div className="text-right w-full sm:w-auto flex justify-between sm:block">
                      <span className="text-sm text-gray-500 sm:hidden">Total</span>
                      <div>
                        <p className="font-medium text-gray-900">₹{item.totalPrice}</p>
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                        {sellerOrder.status === 'DELIVERED' && (
                          <Button variant="link" className="px-0 h-auto text-green-600 font-medium text-sm mt-1" onClick={() => {
                            setReviewItemId(item.id);
                            setReviewProductName(item.productNameSnapshot);
                            setReviewModalOpen(true);
                          }}>
                            <Star className="h-3 w-3 mr-1" /> Rate Product
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              
              <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between items-center text-sm font-medium text-gray-900">
                <span>Seller Subtotal</span>
                <span>₹{sellerOrder.totalAmount}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <Card className="w-full sm:w-96 shadow-sm border-gray-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 text-lg">Order Total</h3>
            <div className="space-y-3 text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span>₹{order.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform Fee</span>
                <span className="text-green-600">Free</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-900 text-lg">Total Paid</span>
              <span className="font-bold text-green-700 text-xl">₹{order.totalAmount.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
            <DialogDescription>
              Share your experience with {reviewProductName}.
            </DialogDescription>
          </DialogHeader>
          {reviewItemId && (
            <ReviewForm 
              orderItemId={reviewItemId} 
              onSuccess={() => {
                setReviewModalOpen(false);
                alert('Review submitted successfully!');
              }} 
              onCancel={() => setReviewModalOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
