'use client';

import { Suspense, type RefObject } from 'react';
import { ArchiveList } from '../chatList/ArchiveList';
import { ChatList } from '../chatList/ChatList';
import styles from './MainLayout.module.css';

export function ListPane({ archive, scrollRef }: { archive: boolean; scrollRef: RefObject<HTMLDivElement | null> }) {
  return <section aria-label={archive ? 'Archived chats' : 'Chat list'} className={styles.list}>
    {archive ? <ArchiveList scrollRef={scrollRef} /> : <Suspense fallback={null}><ChatList scrollRef={scrollRef} /></Suspense>}
  </section>;
}
