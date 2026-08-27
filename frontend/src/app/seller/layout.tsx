import { RoleGuard } from '@/components/RoleGuard';

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['SELLER']}>
      {children}
    </RoleGuard>
  );
}
