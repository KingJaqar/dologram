import type { DgClient, SyncSource } from '@dologram/shared';
import { createSupabaseSyncSource } from '@dologram/shared/src/sync/supabase';

/** Each source read has a transport deadline and the immutable account/ownership signal. */
export function browserSource(client: DgClient, owner: string, signal: AbortSignal, current: () => boolean): SyncSource {
  const read = () => {
    if (!current()) throw new Error('Sync ownership changed.');
    return createSupabaseSyncSource(client, owner, AbortSignal.any([signal, AbortSignal.timeout(10_000)]));
  };
  return {
    fetchChats: () => read().fetchChats(), fetchChat: (id) => read().fetchChat(id),
    fetchMembers: (id) => read().fetchMembers(id), fetchProfiles: (ids) => read().fetchProfiles(ids),
    fetchMessagesAfter: (...args) => read().fetchMessagesAfter(...args),
    fetchMediaAfter: (...args) => read().fetchMediaAfter(...args),
    fetchReactionsAfter: (...args) => read().fetchReactionsAfter(...args),
  };
}
