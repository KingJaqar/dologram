'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/Button/Button';
import { useSession } from './SessionProvider';

export function RouteGuard({ children }: { children: ReactNode }) {
  const { status, error, online, controller } = useSession();
  const router = useRouter();
  // C-5: a route change needs the app's own assets, so an offline browser stays on a signed-out screen
  // until connectivity returns instead of emitting a failed navigation.
  const offline = status === 'signedOut' && !online;
  const destination = offline ? null : status === 'signedOut' ? '/sign-in' : status === 'mustChangePassword' ? '/change-password' : status === 'passwordRecovery' ? '/reset-password' : null;
  useEffect(() => { if (destination) router.replace(destination); }, [destination, router]);
  if (status === 'signedIn') return children;
  if (offline) return <main><h1>DoloGram</h1><p role="status">Signed out on this browser. Reconnect to sign in.</p></main>;
  return <main><h1>DoloGram</h1>{status === 'error' ? <><p role="alert">{error}</p><Button onClick={() => void controller.restore()}>Retry</Button><Button variant="text" onClick={() => void controller.signOut()}>Sign out on this browser</Button></> : <p role="status">Loading your session…</p>}</main>;
}
