'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { strings } from '@dologram/shared/src/strings';
import { ChatRow } from '../../components/ChatRow/ChatRow';
import { ConnectionBanner } from '../../components/ConnectionBanner/ConnectionBanner';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { FolderTabs } from '../../components/FolderTabs/FolderTabs';
import { Icon } from '../../components/Icon/Icon';
import { Skeleton } from '../../components/Skeleton/Skeleton';
import { TopBar } from '../../components/TopBar/TopBar';
import { StoreFeedback } from '../../lib/store/StoreProvider';
import { useChatListData } from './ChatListProvider';
import styles from './ChatList.module.css';

/** D-44: rows are added 50 at a time as the list is scrolled. */
const PAGE_SIZE = 50;
const SKELETON_ROWS = 8;

/** WEB-04: the cached chat list with previews, statuses, unread counts and the Archived row. */
export function ChatList({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const query = useChatListData();
  const requested = useSearchParams().get('folder');
  const data = query.data;
  const folders = useMemo(() => data?.folders ?? [], [data]);
  const selected = requested !== null && folders.some((folder) => folder.folder_id === requested) ? requested : null;
  const chats = useMemo(() => {
    const active = data?.active ?? [];
    if (selected === null) return active;
    const members = new Set((data?.folderChats ?? []).filter((row) => row.folder_id === selected).map((row) => row.chat_id));
    return active.filter((item) => members.has(item.chatId));
  }, [data, selected]);

  const [visible, setVisible] = useState(PAGE_SIZE);
  // A folder change starts its own list at the first page; resetting during render avoids an extra pass.
  const [visibleFor, setVisibleFor] = useState(selected);
  if (visibleFor !== selected) {
    setVisibleFor(selected);
    setVisible(PAGE_SIZE);
  }
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = visible < chats.length;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible((count) => Math.min(count + PAGE_SIZE, chats.length));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, chats.length, visible]);

  const loading = query.status === 'loading' && !data;
  const archivedCount = data?.archived.length ?? 0;

  return (
    <>
      <TopBar variant="chatList" />
      <ConnectionBanner />
      <div className={styles.banners}><StoreFeedback /></div>
      <FolderTabs folders={folders} selected={selected} />
      <div ref={scrollRef} className={styles.content}>
        {query.status === 'error' && !data ? (
          <ErrorState title="Couldn't load" body={strings.common.checkConnection} onRetry={query.retry} />
        ) : (
          <>
            {archivedCount > 0 && (
              <Link className={styles.archived} href="/archive">
                <span className={styles.archivedIcon}><Icon name="action.archive" size="lg" /></span>
                <span>{strings.chatList.archivedRow(archivedCount)}</span>
              </Link>
            )}
            {loading ? (
              // The 300 ms delay comes from Skeleton; the sync status above is the live announcement.
              <div className={styles.skeletons} aria-hidden="true">
                {Array.from({ length: SKELETON_ROWS }, (_, index) => <Skeleton key={index} active />)}
              </div>
            ) : (
              <ul className={styles.rows}>
                {chats.slice(0, visible).map((item) => <ChatRow key={item.chatId} item={item} />)}
              </ul>
            )}
            {hasMore && <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />}
          </>
        )}
      </div>
    </>
  );
}
