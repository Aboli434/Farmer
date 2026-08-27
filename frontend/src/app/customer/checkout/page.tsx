'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCart } from '@/lib/cart/store';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, MapPin, Store, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import Script from 'next/script';
import { addressApi } from '@/lib/api/address';
import { checkoutApi } from '@/lib/api/checkout';
import { Address } from '@/types/address';
import { ApiClientError } from '@/lib/api/client';
import { env } from '@/config/env';

type CheckoutState = 'IDLE' | 'INITIATING_CHECKOUT' | 'PAYMENT_PENDING' | 'PAYMENT_PROCESSING' | 'SUCCESS' | 'FAILED';

export default function CheckoutPage() {
  const { cart, isLoading: isCartLoading, totalItems, fetchCart } = useCart();
  const router = useRouter();
  
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isAddressLoading, setIsAddressLoading] = useState(true);
  
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Address Form State
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    fullName: '',
    phoneNumber: '',
    addressLine1: '',
    city: '',
    state: '',
    pincode: '',
  });

  const loadAddresses = useCallback(async () => {
    try {
      setIsAddressLoading(true);
      const res = await addressApi.getAddresses();
      setAddresses(res.data);
      if (res.data.length > 0) {
        const defaultAddr = res.data.find(a => a.isDefault) || res.data[0];
        setSelectedAddressId(defaultAddr.id);
      } else {
        setShowNewAddressForm(true);
      }
    } catch (err) {
      console.error('Failed to load addresses', err);
    } finally {
      setIsAddressLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAddresses();
  }, [loadAddresses]);

  // Make sure cart is ready
  if (isCartLoading || isAddressLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
      </div>
    );
  }

  const isEmpty = totalItems === 0 || !cart || cart.groupedByProducer?.length === 0;

  if (isEmpty && checkoutState !== 'SUCCESS') {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Checkout</h1>
        <div className="bg-white p-10 rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 mb-6">Your cart is empty.</p>
          <Link href="/customer">
            <Button className="bg-green-600 hover:bg-green-700">Return to Marketplace</Button>
          </Link>
        </div>
      </div>
    );
  }

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

  const handleSaveNewAddress = async () => {
    try {
      setIsAddressLoading(true);
      setErrorMsg(null);
      const res = await addressApi.createAddress({
        type: 'HOME',
        ...newAddress,
      });
      await loadAddresses();
      setSelectedAddressId(res.data.id);
      setShowNewAddressForm(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to save address');
      }
    } finally {
      setIsAddressLoading(false);
    }
  };

  const handleInitiateCheckout = async () => {
    if (!selectedAddressId) {
      setErrorMsg('Please select a pickup/billing address');
      return;
    }

    setCheckoutState('INITIATING_CHECKOUT');
    setErrorMsg(null);

    try {
      // 1. Initiate checkout to create Razorpay order and reserve inventory
      const idempotencyKey = crypto.randomUUID();
      const res = await checkoutApi.initiateCheckout({
        addressId: selectedAddressId,
        idempotencyKey,
      });

      const { providerOrderId, razorpayOrderAmount, razorpayOrderCurrency, payment } = res.data;

      // 2. Open Razorpay Checkout
      setCheckoutState('PAYMENT_PENDING');
      
      const options = {
        key: env.RAZORPAY_KEY_ID, // Use NEXT_PUBLIC_ key
        amount: razorpayOrderAmount,
        currency: razorpayOrderCurrency,
        name: 'Farmer Marketplace',
        description: 'Fresh Produce Order',
        order_id: providerOrderId,
        handler: function () {
          // Razorpay returns razorpay_payment_id, razorpay_order_id, razorpay_signature
          // In our architecture, the webhook handles actual verification.
          // We just redirect to the order page where it will show "Processing" until webhook finishes.
          setCheckoutState('PAYMENT_PROCESSING');
          fetchCart(); // Clear cart from frontend state as backend has converted it
          router.push(`/customer/orders/${payment.orderId}?payment_status=processing`);
        },
        modal: {
          ondismiss: function () {
            // User closed the Razorpay modal
            setCheckoutState('FAILED');
            setErrorMsg('Payment was cancelled. You can retry the payment below.');
          }
        },
        theme: {
          color: '#16a34a' // green-600
        }
      };

      const rzp = new (window as unknown as { Razorpay: new (options: unknown) => { on: (event: string, handler: (res: { error: { description: string } }) => void) => void, open: () => void } }).Razorpay(options);
      rzp.on('payment.failed', function (res: { error: { description: string } }) {
        setCheckoutState('FAILED');
        setErrorMsg(`Payment Failed: ${res.error.description}`);
      });
      
      rzp.open();

    } catch (err) {
      setCheckoutState('FAILED');
      if (err instanceof ApiClientError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to initiate checkout. Please try again.');
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/customer/cart">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <ArrowLeft className="h-5 w-5 text-gray-500" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Secure Checkout</h1>
        </div>
        <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1.5 rounded-full text-sm font-medium">
          <ShieldCheck className="h-4 w-4" />
          SSL Encrypted
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 text-red-700 bg-red-50 rounded-lg border border-red-200">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Address & Payment Methods */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Address Section */}
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-gray-50 border-b pb-4 pt-5">
              <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-600" />
                Pickup & Billing Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              
              {showNewAddressForm ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input value={newAddress.fullName} onChange={e => setNewAddress({...newAddress, fullName: e.target.value})} placeholder="John Doe" />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input value={newAddress.phoneNumber} onChange={e => setNewAddress({...newAddress, phoneNumber: e.target.value})} placeholder="9876543210" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address Line 1</Label>
                    <Input value={newAddress.addressLine1} onChange={e => setNewAddress({...newAddress, addressLine1: e.target.value})} placeholder="House/Flat No., Street" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value})} placeholder="City" />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input value={newAddress.state} onChange={e => setNewAddress({...newAddress, state: e.target.value})} placeholder="State" />
                    </div>
                    <div className="space-y-2">
                      <Label>Pincode</Label>
                      <Input value={newAddress.pincode} onChange={e => setNewAddress({...newAddress, pincode: e.target.value})} placeholder="Pincode" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button onClick={handleSaveNewAddress} disabled={isAddressLoading} className="bg-green-600 hover:bg-green-700">
                      {isAddressLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Address
                    </Button>
                    {addresses.length > 0 && (
                      <Button variant="outline" onClick={() => setShowNewAddressForm(false)}>Cancel</Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {addresses.map(addr => (
                    <div 
                      key={addr.id} 
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={`p-4 border rounded-xl cursor-pointer transition-all ${selectedAddressId === addr.id ? 'border-green-600 bg-green-50 ring-1 ring-green-600' : 'border-gray-200 hover:border-green-300'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 h-4 w-4 rounded-full border flex items-center justify-center ${selectedAddressId === addr.id ? 'border-green-600 bg-green-600' : 'border-gray-300'}`}>
                            {selectedAddressId === addr.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{addr.fullName} <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{addr.type}</span></p>
                            <p className="text-sm text-gray-600 mt-1">{addr.addressLine1}</p>
                            <p className="text-sm text-gray-600">{addr.city}, {addr.state} {addr.pincode}</p>
                            <p className="text-sm font-medium text-gray-800 mt-1">{addr.phoneNumber}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <Button variant="outline" onClick={() => setShowNewAddressForm(true)} className="w-full border-dashed">
                    + Add New Address
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review Order Section */}
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-gray-50 border-b pb-4 pt-5">
              <CardTitle className="text-lg text-gray-800">Review Your Order</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {cart?.groupedByProducer?.map(group => (
                  <div key={group.producerId} className="p-6">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                      <Store className="h-4 w-4 text-green-600" />
                      {group.farmName}
                      <span className="text-xs font-normal text-gray-500 ml-auto border border-gray-200 px-2 py-1 rounded-md">Self Pickup</span>
                    </h3>
                    <ul className="space-y-4">
                      {group.items.map(item => (
                        <li key={item.id} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 font-medium">
                              {item.productName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{item.productName}</p>
                              <p className="text-gray-500">{item.quantity} × ₹{item.price} / {item.unit}</p>
                            </div>
                          </div>
                          <div className="font-medium text-gray-900">
                            ₹{item.price * item.quantity}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column: Order Summary & Pay */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24 border-gray-200 shadow-sm">
            <CardHeader className="bg-gray-50 border-b pb-4 pt-5">
              <CardTitle className="text-lg text-gray-800">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Items Total ({totalItems})</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Fee</span>
                  <span className="text-green-600">Free</span>
                </div>
                <div className="border-t pt-3 mt-3 flex justify-between font-bold text-lg text-gray-900">
                  <span>Total Amount</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-8">
                <Button 
                  onClick={handleInitiateCheckout}
                  disabled={checkoutState === 'INITIATING_CHECKOUT' || checkoutState === 'PAYMENT_PENDING' || !selectedAddressId || showNewAddressForm}
                  className="w-full h-14 text-lg font-semibold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 transition-all"
                >
                  {checkoutState === 'INITIATING_CHECKOUT' ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing Checkout...</>
                  ) : checkoutState === 'PAYMENT_PENDING' ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Awaiting Payment...</>
                  ) : checkoutState === 'PAYMENT_PROCESSING' ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying...</>
                  ) : checkoutState === 'FAILED' ? (
                    'Retry Payment'
                  ) : (
                    `Pay ₹${subtotal.toFixed(2)} securely`
                  )}
                </Button>
                
                <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                  Payments powered by Razorpay
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
