import type { ReactNode } from 'react';
import { SessionProvider } from '../../lib/session/SessionProvider';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
