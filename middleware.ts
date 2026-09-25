import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifySessionToken(token) : null;

  if (pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  if (pathname === '/login') {
    if (payload) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api/health|icon.png|apple-icon.png|favicon.ico|brand/|fonts/).*)',
  ],
};
