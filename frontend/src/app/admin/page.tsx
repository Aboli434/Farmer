'use client';

import { useAuth } from '@/lib/auth/store';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  
  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <p className="mb-4">System Administrator: {user?.name}</p>
      <Button onClick={logout} variant="destructive">Logout</Button>
    </div>
  );
}
