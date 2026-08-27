'use client';

import { useState } from 'react';
import { useCart } from '@/lib/cart/store';
import { Loader2, ArrowLeft, Trash2, MapPin, Store, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiClientError } from '@/lib/api/client';

export default function CartPage() {
  const { cart, isLoading, addItem, removeItem, totalItems } = useCart();
  const router = useRouter();
  const [loadingItems, setLoadingItems] = useState<{ [key: string]: boolean }>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpdateQuantity = async (variantId: string, newQuantity: number) => {
    if (newQuantity <= 0) return handleRemoveItem(variantId);
    
    setErrorMsg(null);
    setLoadingItems(prev => ({ ...prev, [variantId]: true }));
    try {
      await addItem(variantId, newQuantity);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to update quantity');
      }
    } finally {
      setLoadingItems(prev => ({ ...prev, [variantId]: false }));
    }
  };

  const handleRemoveItem = async (variantId: string) => {
    setErrorMsg(null);
    setLoadingItems(prev => ({ ...prev, [variantId]: true }));
    try {
      await removeItem(variantId);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to remove item');
      }
    } finally {
      setLoadingItems(prev => ({ ...prev, [variantId]: false }));
    }
  };

  if (isLoading && !cart) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
      </div>
    );
  }

  const isEmpty = totalItems === 0 || !cart || cart.groupedByProducer?.length === 0;

  if (isEmpty) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <ShoppingCartPlaceholder />
          <h3 className="text-xl font-medium text-gray-900 mt-4">Your cart is empty</h3>
          <p className="text-gray-500 mt-2 mb-6">Looks like you haven&apos;t added any fresh produce yet.</p>
          <Link href="/customer">
            <Button className="bg-green-600 hover:bg-green-700">
              Start Shopping
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate Subtotals
  const calculateSubtotal = () => {
    let sub = 0;
    cart?.groupedByProducer?.forEach(group => {
      group.items.forEach(item => {
        sub += item.price * item.quantity;
      });
    });
    return sub;
  };

  const subtotal = calculateSubtotal();

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <Link href="/customer" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-green-700 mb-6 transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Continue Shopping
      </Link>
      
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>
      
      {errorMsg && (
        <div className="mb-6 p-4 text-red-700 bg-red-50 rounded-lg border border-red-200 flex items-center justify-between">
          <span>{errorMsg}</span>
          <Button variant="ghost" size="sm" onClick={() => setErrorMsg(null)}>Dismiss</Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Cart Items Area */}
        <div className="lg:col-span-2 space-y-6">
          {cart?.groupedByProducer?.map((group) => (
            <Card key={group.producerId} className="overflow-hidden shadow-sm border-gray-200">
              <CardHeader className="bg-gray-50 border-b pb-4 pt-5">
                <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
                  <Store className="h-5 w-5 text-green-600" />
                  {group.farmName}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-gray-100">
                  {group.items.map((item) => {
                    const isItemLoading = loadingItems[item.variantId];
                    return (
                      <li key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center hover:bg-gray-50/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-semibold text-gray-900 line-clamp-1">
                            {item.productName}
                          </h4>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {item.label} • ₹{item.price} / {item.unit}
                          </p>
                          <div className="text-sm font-medium text-gray-900 mt-2">
                            Total: <span className="text-green-700">₹{item.price * item.quantity}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
                          <div className="flex items-center border border-gray-300 rounded-lg bg-white">
                            <button 
                              onClick={() => handleUpdateQuantity(item.variantId, item.quantity - 1)}
                              disabled={isItemLoading}
                              className="p-2 text-gray-500 hover:text-green-700 disabled:opacity-50 transition-colors"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-10 text-center font-medium text-sm">
                              {isItemLoading ? <Loader2 className="h-3 w-3 animate-spin mx-auto text-green-600" /> : item.quantity}
                            </span>
                            <button 
                              onClick={() => handleUpdateQuantity(item.variantId, item.quantity + 1)}
                              disabled={isItemLoading || item.quantity >= item.availableStock}
                              className="p-2 text-gray-500 hover:text-green-700 disabled:opacity-50 transition-colors"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRemoveItem(item.variantId)}
                            disabled={isItemLoading}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 -mr-2"
                            title="Remove item"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24 shadow-sm border-gray-200">
            <CardHeader className="border-b bg-gray-50 pb-4 pt-5">
              <CardTitle className="text-lg text-gray-800">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Items ({totalItems})</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between text-gray-600">
                  <span>Platform Fee</span>
                  <span className="text-green-600 font-medium">Free</span>
                </div>
                
                <div className="border-t pt-4 mt-4 flex justify-between font-bold text-lg text-gray-900">
                  <span>Subtotal</span>
                  <span className="text-green-700">₹{subtotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <Button 
                  onClick={() => router.push('/customer/checkout')}
                  className="w-full h-12 text-base font-semibold bg-green-600 hover:bg-green-700"
                >
                  Proceed to Checkout
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
                  <MapPin className="h-3.5 w-3.5" />
                  Delivery details will be collected at checkout
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
      </div>
    </div>
  );
}

function ShoppingCartPlaceholder() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-gray-300">
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}
