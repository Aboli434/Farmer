'use client';

import { useAuth } from '@/lib/auth/store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Role } from '@/types/auth';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.push('/login');
      } else if (!allowedRoles.includes(user.role)) {
        router.push('/forbidden');
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, router]);

  if (isLoading || !isAuthenticated || !user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
      </div>
    );
  }

  return <>{children}</>;
}
