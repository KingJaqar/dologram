'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useSession } from '../../lib/session/SessionProvider';
import { useStore } from '../../lib/store/StoreProvider';
import { useStoreQuery } from '../../lib/store/useStoreQuery';
import { readChatList, type ChatListData } from './query';

type ChatListQuery = ReturnType<typeof useStoreQuery<ChatListData>>;
const Context = createContext<ChatListQuery | null>(null);

/**
 * One cache read for the whole shell: the list panes render from it and the document title takes
 * its unread total, so a store change never recomputes the list twice (WEB-03, D-W15).
 */
export function ChatListProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const read = useCallback(() => readChatList(store, userId), [store, userId]);
  const query = useStoreQuery(store, read);
  return <Context value={query}>{children}</Context>;
}

export function useChatListData(): ChatListQuery {
  const value = useContext(Context);
  if (!value) throw new Error('ChatListProvider is required');
  return value;
}
