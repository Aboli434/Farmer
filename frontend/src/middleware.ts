import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const token = request.cookies.get('token')?.value;

  const roleRoutes = [
    { prefix: '/customer', requiredRole: 'CUSTOMER' },
    { prefix: '/seller', requiredRole: 'SELLER' },
    { prefix: '/admin', requiredRole: 'ADMIN' },
  ];

  const protectedRoute = roleRoutes.find(route => pathname.startsWith(route.prefix));

  if (protectedRoute) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Redirect authenticated users away from login
  if (pathname === '/login' && token) {
    // We cannot easily determine role from here without an API call or decoding JWT
    // So we just let them go to the root or a generic dashboard, but actually 
    // the layout guards will handle precise role routing if we redirect them somewhere.
    // However, it's safer to let them render /login and let the client-side AuthProvider redirect them.
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/customer/:path*', '/seller/:path*', '/admin/:path*', '/login'],
};
