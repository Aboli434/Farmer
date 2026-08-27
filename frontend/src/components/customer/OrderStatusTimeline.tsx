'use client';

import { CheckCircle2, Clock, Truck, PackageCheck, AlertCircle, ShoppingBag } from 'lucide-react';
import { OrderStatus } from '@/types/order';

interface OrderStatusTimelineProps {
  status: OrderStatus;
}

export function OrderStatusTimeline({ status }: OrderStatusTimelineProps) {
  // If cancelled or rejected, show a separate terminal state
  if (status === 'CANCELLED' || status === 'REJECTED') {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
        <AlertCircle className="h-6 w-6" />
        <div>
          <h4 className="font-semibold text-lg">Order {status === 'CANCELLED' ? 'Cancelled' : 'Rejected'}</h4>
          <p className="text-sm">This order will not be fulfilled.</p>
        </div>
      </div>
    );
  }

  // Linear progression
  const steps = [
    { key: 'PENDING', label: 'Pending', icon: Clock },
    { key: 'CONFIRMED', label: 'Confirmed', icon: CheckCircle2 },
    { key: 'PREPARING', label: 'Preparing', icon: ShoppingBag },
    { key: 'READY', label: 'Ready for Pickup', icon: PackageCheck }, // Assuming pickup model primarily
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Truck },
    { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 },
  ];

  // Determine current step index
  let currentIndex = steps.findIndex(s => s.key === status);
  if (currentIndex === -1) currentIndex = 0; // fallback

  return (
    <div className="py-6">
      <div className="relative">
        {/* Track Line */}
        <div className="absolute top-1/2 left-4 right-4 h-1 bg-gray-200 -translate-y-1/2 rounded-full hidden sm:block"></div>
        {/* Active Track Line */}
        <div 
          className="absolute top-1/2 left-4 h-1 bg-green-500 -translate-y-1/2 rounded-full transition-all duration-500 hidden sm:block" 
          style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
        ></div>

        <div className="relative flex flex-col sm:flex-row sm:justify-between gap-6 sm:gap-0">
          {steps.map((step, idx) => {
            const isActive = idx <= currentIndex;
            const isCurrent = idx === currentIndex;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex sm:flex-col items-center gap-4 sm:gap-2 relative z-10">
                <div 
                  className={`
                    h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center border-4 transition-colors duration-300
                    ${isActive 
                      ? 'bg-green-600 border-green-100 text-white' 
                      : 'bg-white border-gray-100 text-gray-400'
                    }
                    ${isCurrent ? 'ring-4 ring-green-100' : ''}
                  `}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="sm:text-center">
                  <p className={`text-sm font-semibold ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
