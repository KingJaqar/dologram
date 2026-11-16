import { describe, expect, it } from 'vitest';
import { createDgClient } from '../../client';
import { listMyChats } from '../chats';

function clientWithPages(pages: Array<string[] | null>) {
  const requests: URL[] = [];
  const client = createDgClient({
    url: 'https://dologram.example',
    key: 'test-key',
    storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    fetch: async (input) => {
      requests.push(new URL(String(input)));
      const page = pages.shift();
      if (page === null) return Response.json({ code: '42501', message: 'Denied' }, { status: 403 });
      if (!page) throw new Error('unexpected page request');
      return Response.json(page.map((chat_id) => ({ chat_id })));
    },
  });
  return { client, requests };
}

describe('listMyChats', () => {
  it('continues past a server-capped page and scopes every request to the account', async () => {
    const { client, requests } = clientWithPages([['a', 'b'], ['c'], []]);
    const result = await listMyChats(client, 'account-a');

    expect(result.data?.map((row) => row.chat_id)).toEqual(['a', 'b', 'c']);
    expect(requests.map(({ searchParams }) => searchParams.get('chat_id'))).toEqual([null, 'gt.b', 'gt.c']);
    for (const { searchParams } of requests) {
      expect(searchParams.get('select')).toBe('*,chat_members!inner()');
      expect(searchParams.get('chat_members.user_id')).toBe('eq.account-a');
      expect(searchParams.get('order')).toBe('chat_id.asc');
    }
  });

  it('reports a later-page failure instead of returning a partial list for cache pruning', async () => {
    const { client } = clientWithPages([['a'], null]);
    const result = await listMyChats(client, 'account-a');

    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });
});
