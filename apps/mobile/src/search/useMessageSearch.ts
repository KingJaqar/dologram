import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeCacheChange } from '../sync/cacheEvents';
import { subscribeQueueChange } from '../queue/events';
import { subscribeChatPreferenceChanges } from '../chats/preferences';
import { normalizeSearch } from './matching';
import type { SearchIdentity, SearchScope } from './query';
import { readSearch, SEARCH_DEADLINE_MS, SearchFailure } from './request';

type SearchState<T> = { key: string; revision: number; generation: number; lifetime: { valid: boolean }; data: T | null; error: 'read' | 'timeout' | 'unavailable' | null };

/** Shared lifecycle for summary and scoped-page readers. `active` follows screen focus.
 * Readers revalidate eligibility on every invocation; request identities are immutable snapshots.
 */
export function useMessageSearch<T>(
  scope: SearchScope, query: string, active: boolean,
  load: (identity: SearchIdentity, signal: AbortSignal) => Promise<T>,
  observedChatIds: readonly string[] = scope.allowedChatIds,
) {
  const normalizedQuery = normalizeSearch(query);
  const ids = JSON.stringify([...new Set(scope.allowedChatIds)].sort());
  const observedIds = JSON.stringify([...new Set(observedChatIds)].sort());
  const key = JSON.stringify([scope.userId, ids, scope.chatId, normalizedQuery, active]);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<SearchState<T> | null>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const invalidate = useCallback(() => {
    controller.current?.abort();
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
    const request = new AbortController();
    controller.current = request;
    const currentGeneration = ++generation.current;
    const lifetime = { valid: true };
    const identity: SearchIdentity = { userId: scope.userId, allowedChatIds: JSON.parse(ids),
      chatId: scope.chatId, normalizedQuery, generation: currentGeneration };
    const timer = setTimeout(() => {
      void readSearch(() => load(identity, request.signal), request.signal, Date.now() + SEARCH_DEADLINE_MS).then((data) => {
        if (!request.signal.aborted && generation.current === currentGeneration) setState({ key, revision, generation: currentGeneration, lifetime, data, error: null });
      }, (error: unknown) => {
        if (request.signal.aborted || generation.current !== currentGeneration) return;
        request.abort();
        const kind = error instanceof SearchFailure ? error.kind : 'read';
        setState({ key, revision, generation: currentGeneration, lifetime, data: null, error: kind === 'timeout' ? 'timeout' : kind === 'unavailable' ? 'unavailable' : 'read' });
      });
    }, 150);
    return () => {
      clearTimeout(timer); request.abort();
      lifetime.valid = false;
      if (controller.current === request) controller.current = null;
    };
  }, [active, ids, key, load, normalizedQuery, revision, scope.chatId, scope.userId]);

  const enabled = active && !!scope.userId && !!normalizedQuery;
  const current = enabled && state?.key === key && state.revision === revision && state.lifetime.valid ? state : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading: enabled && !current, retry: invalidate };
}
