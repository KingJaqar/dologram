import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_ORIGIN, isMutation, localRequestStatus, SESSION_COOKIE } from './server/requestPolicy';

export function proxy(request: NextRequest) {
  const mutation = isMutation(request.method);
  const status = localRequestStatus(request.headers, mutation);
  if (status) return NextResponse.json({ ok: false, message: 'Request refused.' }, { status });
  const path = request.nextUrl.pathname;
  // Host/Origin checks cover assets as well. Only framework assets and the app icon are public.
  const asset = path.startsWith('/_next/static/') || path.startsWith('/_next/image') || path === '/icon.png';
  if (path !== '/sign-in' && path !== '/unlock' && !asset && !request.cookies.has(SESSION_COOKIE)) {
    if (path.startsWith('/api/') || mutation) {
      return NextResponse.json({ ok: false, code: 'unauthorized', message: 'Sign in required.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/sign-in', ADMIN_ORIGIN));
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

