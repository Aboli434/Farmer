'use client';

import { RoleGuard } from '@/components/RoleGuard';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  ListOrdered, 
  User, 
  LogOut,
  Menu,
  Box,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/store';
import { sellerApi } from '@/lib/api/seller';
import { ProducerProfile } from '@/types/seller';
import { Badge } from '@/components/ui/badge';

function SellerSidebar({ isMobileOpen, setIsMobileOpen }: { isMobileOpen: boolean, setIsMobileOpen: (v: boolean) => void }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  
  const navItems = [
    { name: 'Dashboard', href: '/seller', icon: LayoutDashboard },
    { name: 'Products', href: '/seller/products', icon: Package },
    { name: 'Inventory', href: '/seller/inventory', icon: Box },
    { name: 'Orders', href: '/seller/orders', icon: ListOrdered },
    { name: 'Profile', href: '/seller/profile', icon: User },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:h-screen md:flex md:flex-col
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-gray-200 shrink-0">
          <span className="text-xl font-bold text-green-700">Seller Portal</span>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`
                    flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-green-50 text-green-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-green-700' : 'text-gray-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-200 shrink-0">
          <button
            onClick={() => logout()}
            className="flex w-full items-center px-3 py-2.5 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

function SellerLayoutContent({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [profile, setProfile] = useState<ProducerProfile | null>(null);
  const [isSuspended, setIsSuspended] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Fetch producer profile to check verification status
    sellerApi.getProducerProfile().then(res => {
      if (res.success && res.data) {
        setProfile(res.data);
      }
    }).catch(err => {
      if (err.status === 403) {
        setIsSuspended(true);
      }
    });
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <SellerSidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden mr-2 -ml-2"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900 truncate hidden sm:block">
              {profile?.farmName || user?.name || 'Seller Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {isSuspended && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Suspended
              </Badge>
            )}
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
              {(profile?.farmName || user?.name || 'S').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {isSuspended && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Account Suspended</h3>
                <p className="mt-1 text-sm text-red-700">
                  Your seller account has been suspended. You cannot make any changes or process orders until the issue is resolved. Please contact support.
                </p>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['SELLER']}>
      <SellerLayoutContent>{children}</SellerLayoutContent>
    </RoleGuard>
  );
}
