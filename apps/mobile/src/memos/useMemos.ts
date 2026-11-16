import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Memo, MemoSearchFilter } from '@dologram/shared';
import { useMemoAccess } from './MemoProvider';
import { isMemoScopeCurrent } from './lifecycle';
import { subscribeMemos, withMemoStore } from './vault';
const emptyMemos: Memo[] = [];
const emptyLinks: { memo_id: string; folder_id: string }[] = [];
const emptyAccounting = { live_bytes: 0, trash_bytes: 0, staging_bytes: 0, repair_bytes: 0, total_bytes: 0 };
const emptyCounts = { all: 0, messages: 0, photos: 0, videos: 0, photosVideos: 0, audios: 0, files: 0, links: 0, others: 0 } satisfies Record<MemoSearchFilter, number>;

export function useMemos(filter: MemoSearchFilter = 'all') {
  const { scope, error: enrollmentError } = useMemoAccess();
  const [loaded, setLoaded] = useState<{ generation: number; filter: MemoSearchFilter; memos: Memo[]; trash: Memo[]; links: { memo_id: string; folder_id: string }[]; accounting: typeof emptyAccounting; largest: { asset_id: string; memo_id: string; original_name: string; byte_size: number; detected_type: string; availability: string; memo_title: string; deleted_at: number | null }[]; counts: Record<MemoSearchFilter, number> } | null>(null);
  const [failure, setFailure] = useState<{ generation: number; message: string } | null>(null);
  const reload = useCallback(async () => {
    if (!scope) return;
    try {
      const result = await withMemoStore(scope, async (store) => ({ memos: filter === 'all' ? await store.list() : await store.listFiltered(filter), trash: await store.listTrash(), links: await store.folderLinks(), accounting: await store.accounting(), largest: await store.largestAssets(5), counts: await store.filterCounts() }));
      if (isMemoScopeCurrent(scope)) { setLoaded({ generation: scope.generation, filter, ...result }); setFailure(null); }
    } catch (error: unknown) {
      if (isMemoScopeCurrent(scope)) setFailure({ generation: scope.generation, message: error instanceof Error ? error.message : 'Could not open memos. Retry.' });
    }
  }, [filter, scope]);
  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => { if (active) void reload(); };
    const unsubscribe = subscribeMemos(refresh);
    refresh();
    return () => { active = false; unsubscribe(); };
  }, [reload]));
  const current = loaded?.generation === scope?.generation && loaded?.filter === filter ? loaded : null;
  const error = enrollmentError ?? (failure?.generation === scope?.generation ? failure?.message ?? null : null);
  return { memos: current?.memos ?? emptyMemos, trash: current?.trash ?? emptyMemos, links: current?.links ?? emptyLinks, accounting: current?.accounting ?? emptyAccounting, largest: current?.largest ?? [], counts: current?.counts ?? emptyCounts, loading: Boolean(scope && !current && !error), error, reload };
}
