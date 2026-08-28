'use client';

import { RoleGuard } from '@/components/RoleGuard';
import Link from 'next/link';
import { Search, MapPin, Bell, ShoppingCart, User, Package, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CartProvider, useCart } from '@/lib/cart/store';

function CustomerHeader() {
  const { totalItems } = useCart();
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        {/* Logo */}
        <div className="flex-shrink-0 flex items-center">
          <Link href="/customer" className="flex items-center gap-2">
            <span className="text-xl font-bold text-green-700 hidden sm:block">Farmer Marketplace</span>
            <span className="text-xl font-bold text-green-700 sm:hidden">FM</span>
          </Link>
        </div>

        {/* Global Search - Hidden on very small screens, visible on md+ */}
        <div className="hidden md:flex flex-1 max-w-xl items-center relative">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <Input 
              type="text" 
              placeholder="Search fresh produce..." 
              className="pl-10 w-full bg-gray-100 border-transparent focus:bg-white"
            />
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <Link href="/customer/orders" className="flex items-center space-x-1 text-gray-600 hover:text-green-700 font-medium">
            <Package className="h-5 w-5" />
            <span className="hidden sm:inline text-sm">Orders</span>
          </Link>
          <Link href="/customer/profile" className="flex items-center space-x-1 text-gray-600 hover:text-green-700 font-medium">
            <User className="h-5 w-5" />
            <span className="hidden sm:inline text-sm">Profile</span>
          </Link>
          
          <Button variant="ghost" size="icon" className="relative text-gray-600 hover:text-green-700">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border border-white"></span>
          </Button>
          
          <Link href="/customer/cart">
            <Button variant="ghost" size="icon" className="relative text-gray-600 hover:text-green-700">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute top-1 right-0 h-4 w-4 rounded-full bg-green-600 text-[10px] font-bold text-white flex items-center justify-center">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </Button>
          </Link>

          {/* Simple User Menu placeholder */}
          <div className="relative ml-2">
            <Button variant="outline" size="icon" className="rounded-full h-8 w-8 overflow-hidden bg-gray-100 border-gray-200 text-gray-600">
              <UserIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Search Bar (shows only on small screens) */}
      <div className="md:hidden px-4 pb-3 pt-1">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <Input 
            type="text" 
            placeholder="Search..." 
            className="pl-10 w-full bg-gray-100 border-transparent focus:bg-white h-9"
          />
        </div>
      </div>
    </header>
  );
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  // We don't want to break if used directly, but usually this is wrapped by RoleGuard which provides Auth
  return (
    <RoleGuard allowedRoles={['CUSTOMER']}>
      <CartProvider>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <CustomerHeader />

          {/* Main Content Area */}
          <main className="flex-1 w-full container mx-auto px-4 py-6">
            {children}
          </main>
        </div>
      </CartProvider>
    </RoleGuard>
  );
}
