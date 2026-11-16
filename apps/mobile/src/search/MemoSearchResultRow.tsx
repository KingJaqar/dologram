import React from 'react';
import type { MemoSearchResult } from '@dologram/shared';
import { SearchResultRow } from './SearchResultRow';

export const MemoSearchResultRow = React.memo(function MemoSearchResultRow({ result, query, onPress }: { result: MemoSearchResult; query: string; onPress: () => void }) {
  const metadata = [result.item_kind === 'attachment' ? result.display_name : 'Memo text', result.tags.length > 0 ? result.tags.join(', ') : ''].filter(Boolean).join(' · ');
  return <SearchResultRow title={result.memo_title} subtitle={result.snippet} metadata={metadata} query={query} onPress={onPress} />;
});
