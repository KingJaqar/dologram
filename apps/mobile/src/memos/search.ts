import type { MemoSearchFilter, MemoSearchResult } from '@dologram/shared';
import type { MemoScope } from './lifecycle';
import { isMemoScopeCurrent } from './lifecycle';
import { withMemoStore } from './vault';

/** Account-scoped memo search adapter. The vault remains the only owner of the encrypted handle. */
export async function searchMemos(scope: MemoScope, query: string, userId: string, signal: AbortSignal, filter: MemoSearchFilter = 'all'): Promise<MemoSearchResult[]> {
  if (signal.aborted) return [];
  const result = await withMemoStore(scope, (store) => store.search(query, { filter, userId }));
  if (signal.aborted || !isMemoScopeCurrent(scope)) return [];
  return result;
}
