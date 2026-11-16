'use client';

import { useRouter } from 'next/navigation';
import type { RefObject } from 'react';
import { strings } from '@dologram/shared/src/strings';
import { ChatRow } from '../../components/ChatRow/ChatRow';
import { ConnectionBanner } from '../../components/ConnectionBanner/ConnectionBanner';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { TopBar } from '../../components/TopBar/TopBar';
import { StoreFeedback } from '../../lib/store/StoreProvider';
import { useChatListData } from './ChatListProvider';
import styles from './ChatList.module.css';

/** WEB-05: archived chats in the same D-94 order; a new message never moves a chat out (D-94). */
export function ArchiveList({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const query = useChatListData();
  const router = useRouter();
  const archived = query.data?.archived ?? [];
  const loading = query.status === 'loading' && !query.data;

  return (
    <>
      <TopBar variant="screen" title={strings.chatList.archived} onBack={() => router.push('/')} />
      <ConnectionBanner />
      <div className={styles.banners}><StoreFeedback /></div>
      <div ref={scrollRef} className={styles.content}>
        {query.status === 'error' && !query.data ? (
          <ErrorState title="Couldn't load" body={strings.common.checkConnection} onRetry={query.retry} />
        ) : loading ? null : archived.length === 0 ? (
          <EmptyState icon="nav.archive" title={strings.chatList.noArchived} body={strings.chatList.noArchivedBody} />
        ) : (
          <ul className={styles.rows}>
            {archived.map((item) => <ChatRow key={item.chatId} item={item} />)}
          </ul>
        )}
      </div>
    </>
  );
}
