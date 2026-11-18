import { NextResponse, type NextRequest } from 'next/server';

// Optimistic gate only; every protected page still verifies the session and role on the server.
export function proxy(request: NextRequest) {
  if (request.cookies.has('payload-token')) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/student/:path*'],
};
