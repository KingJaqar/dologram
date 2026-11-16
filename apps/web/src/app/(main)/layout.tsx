import type { ReactNode } from 'react';
import { SessionProvider } from '../../lib/session/SessionProvider';
import { RouteGuard } from '../../lib/session/RouteGuard';
import { StoreProvider } from '../../lib/store/StoreProvider';
import { ChatListProvider } from '../../features/chatList/ChatListProvider';
import { MainLayout as Shell } from '../../features/shell/MainLayout';

export default function MainLayout({ children }: { children: ReactNode }) {
  return <SessionProvider><RouteGuard><StoreProvider><ChatListProvider><Shell>{children}</Shell></ChatListProvider></StoreProvider></RouteGuard></SessionProvider>;
}
