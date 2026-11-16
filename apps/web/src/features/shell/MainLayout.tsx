'use client';

import { useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { NavRail } from '../../components/NavRail/NavRail';
import { TabBar } from '../../components/TabBar/TabBar';
import { OverlayProvider } from './OverlayProvider';
import { ListPane } from './ListPane';
import { ChatPane } from './ChatPane';
import { useChatListData } from '../chatList/ChatListProvider';
import { useDocumentTitle } from './useDocumentTitle';
import styles from './MainLayout.module.css';

export function MainLayout({ children, info }: { children: ReactNode; info?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const chatOpen = pathname.startsWith('/chat/');
  const list = useRef<HTMLDivElement>(null);
  const { data } = useChatListData();
  useDocumentTitle(data?.totalUnread ?? 0);
  return <OverlayProvider><main className={styles.shell} data-chat={chatOpen || undefined} data-info={!!info || undefined}>
    <NavRail key={pathname} />
    <ListPane scrollRef={list} archive={pathname === '/archive'} />
    <div className={styles.chat}>{chatOpen ? children : <ChatPane />}</div>
    {info && <aside className={styles.info} aria-label="Chat information">{info}</aside>}
    {!chatOpen && <TabBar onChats={() => { if (pathname !== '/') router.push('/'); list.current?.scrollTo({ top: 0, behavior: 'instant' }); }} />}
  </main></OverlayProvider>;
}
