import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { listCallHistory, strings, type CallHistoryCursor, type CallHistoryRow } from '@dologram/shared';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
export { callDirection, callOutcome, formatCallDuration } from './historyFormat';

export type CallHistoryState = {
  rows: CallHistoryRow[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  nextCursor: CallHistoryCursor | null;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
};

function appendUnique(current: CallHistoryRow[], next: CallHistoryRow[]): CallHistoryRow[] {
  const seen = new Set(current.map((row) => row.callId));
  return [...current, ...next.filter((row) => !seen.has(row.callId))];
}

export function useCallHistory(chatId: string | undefined): CallHistoryState {
  const { status, session } = useAuth();
  const userId = status === 'signedIn' ? session?.user.id : undefined;
  const [rows, setRows] = useState<CallHistoryRow[]>([]);
  const [nextCursor, setNextCursor] = useState<CallHistoryCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const reload = useCallback(async () => {
    if (!chatId || !userId) {
      generationRef.current += 1;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setRows([]);
      setNextCursor(null);
      setError(null);
      setLoading(false);
      return;
    }
    const generation = ++generationRef.current;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setLoading(true);
    setError(null);
    try {
      const result = await listCallHistory(supabase, chatId);
      if (generation !== generationRef.current) return;
      if (result.error || !result.data) {
        setError(strings.callsHistory.loadFailed);
        return;
      }
      setRows(result.data.rows);
      setNextCursor(result.data.nextCursor);
    } catch {
      if (generation === generationRef.current) setError(strings.callsHistory.loadFailed);
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [chatId, userId]);

  const loadMore = useCallback(async () => {
    if (!chatId || !userId || !nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const generation = generationRef.current;
    try {
      const result = await listCallHistory(supabase, chatId, nextCursor);
      if (generation === generationRef.current) {
        if (result.error || !result.data) setError(strings.callsHistory.loadFailed);
        else {
          setRows((current) => appendUnique(current, result.data.rows));
          setNextCursor(result.data.nextCursor);
        }
      }
    } catch {
      if (generation === generationRef.current) setError(strings.callsHistory.loadFailed);
    } finally {
      if (generation === generationRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [chatId, nextCursor, userId]);

  useFocusEffect(useCallback(() => {
    void reload();
    return () => {
      generationRef.current += 1;
      loadingMoreRef.current = false;
    };
  }, [reload]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  return { rows, loading, refreshing, loadingMore, error, nextCursor, reload: refresh, loadMore };
}
