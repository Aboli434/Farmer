'use client';

import { useAuth } from '@/lib/auth/store';
import { Button } from '@/components/ui/button';

export default function SellerDashboard() {
  const { user, logout } = useAuth();
  
  return (
    <div className="p-8 bg-green-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-green-900">Seller Dashboard</h1>
      <p className="mb-4">Welcome to your producer portal, {user?.name}.</p>
      <Button onClick={logout} variant="outline" className="border-green-600 text-green-700">Logout</Button>
    </div>
  );
}
