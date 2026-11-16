import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeCacheChange } from '../sync/cacheEvents';
import { subscribeQueueChange } from '../queue/events';
import { subscribeChatPreferenceChanges } from '../chats/preferences';
import { normalizeSearch } from './matching';
import type { SearchIdentity, SearchScope } from './query';
import { readSearch, readSerializedSearch, SEARCH_DEADLINE_MS, SearchFailure } from './request';

type SearchState<T> = { key: string; revision: number; data: T | null; error: 'read' | 'timeout' | 'unavailable' | null };

/** Shared lifecycle for summary and scoped-page readers. `active` follows screen focus.
 * Readers revalidate eligibility on every invocation; request identities are immutable snapshots.
 * The last completed result is retained while the screen is covered so focus returns do not
 * replace typed results with a loading state; `epoch` advances whenever an invalidation or an
 * explicit retry makes consumer-held derived pages (for example cursor pages) stale.
 */
export function useMessageSearch<T>(
  scope: SearchScope, query: string, active: boolean,
  load: (identity: SearchIdentity, signal: AbortSignal) => Promise<T>,
  observedChatIds: readonly string[] = scope.allowedChatIds,
) {
  const normalizedQuery = normalizeSearch(query);
  const ids = JSON.stringify([...new Set(scope.allowedChatIds)].sort());
  const observedIds = JSON.stringify([...new Set(observedChatIds)].sort());
  const key = JSON.stringify([scope.userId, ids, scope.chatId, normalizedQuery]);
  const serializationKey = JSON.stringify([scope.userId, ids, scope.chatId ?? null]);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<SearchState<T> | null>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const invalidationQueued = useRef(false);
  const invalidate = useCallback(() => {
    controller.current?.abort();
    if (invalidationQueued.current) return;
    invalidationQueued.current = true;
    setRevision((previous) => previous + 1);
  }, []);

  useEffect(() => {
    if (!active || !scope.userId) return;
    const chatIds: string[] = JSON.parse(observedIds);
    const changed = () => {
      // Hide results immediately; coalesce the ensuing scan behind one debounce timer.
      invalidate();
    };
    const stops = [subscribeCacheChange(changed), subscribeQueueChange(changed),
      ...chatIds.map((id) => subscribeChatPreferenceChanges(scope.userId, id, changed))];
    return () => { stops.forEach((stop) => stop()); };
  }, [active, observedIds, invalidate, scope.userId]);

  useEffect(() => {
    if (!active || !scope.userId || !normalizedQuery) return;
    invalidationQueued.current = false;
    const request = new AbortController();
    controller.current = request;
    const currentGeneration = ++generation.current;
    const identity: SearchIdentity = { userId: scope.userId, allowedChatIds: JSON.parse(ids),
      chatId: scope.chatId, normalizedQuery, generation: currentGeneration };
    const timer = setTimeout(() => {
      const deadline = Date.now() + SEARCH_DEADLINE_MS;
      void readSearch(() => readSerializedSearch(
        serializationKey,
        () => load(identity, request.signal),
        request.signal,
        deadline,
      ), request.signal, deadline).then((data) => {
        if (!request.signal.aborted && generation.current === currentGeneration) setState({ key, revision, data, error: null });
      }, (error: unknown) => {
        if (request.signal.aborted || generation.current !== currentGeneration) return;
        request.abort();
        const kind = error instanceof SearchFailure ? error.kind : 'read';
        setState({ key, revision, data: null, error: kind === 'timeout' ? 'timeout' : kind === 'unavailable' ? 'unavailable' : 'read' });
      });
    }, 150);
    return () => {
      clearTimeout(timer); request.abort();
      if (controller.current === request) controller.current = null;
    };
  }, [active, ids, key, load, normalizedQuery, revision, scope.chatId, scope.userId, serializationKey]);

  const enabled = !!scope.userId && !!normalizedQuery;
  const current = enabled && state?.key === key && state.revision === revision ? state : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: enabled && active && !current,
    epoch: revision,
    retry: invalidate,
  };
}
