'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function ForbiddenPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-3xl text-red-600">403</CardTitle>
          <CardDescription className="text-lg mt-2">
            Access Forbidden
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-6">
            You do not have permission to access this page.
          </p>
          <Button onClick={() => router.push('/login')} className="w-full">
            Return to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
