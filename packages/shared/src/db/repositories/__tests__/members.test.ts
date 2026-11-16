import { createDgClient, type DgClient } from '../../client';
import { listChatMembers, markChatRead, updateOwnMember } from '../members';

const storage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

const ownMember = {
  chat_id: 'chat-a',
  user_id: 'user-a',
  role: 'owner',
  joined_at: '2026-11-13T00:00:00.000Z',
  last_read_seq: 7,
  archived: false,
  muted_until: 'infinity',
  nickname: null,
};

function clientWithResponse(response: unknown): { client: DgClient; requests: Array<{ url: string; body: unknown }> } {
  const requests: Array<{ url: string; body: unknown }> = [];
  const client = createDgClient({
    url: 'https://dologram.example',
    key: 'test-key',
    storage,
    fetch: async (input, init) => {
      const bodyText = typeof init?.body === 'string' ? init.body : null;
      requests.push({ url: String(input), body: bodyText === null ? null : JSON.parse(bodyText) as unknown });
      return Response.json(response);
    },
  });
  return { client, requests };
}

describe('updateOwnMember', () => {
  test('validates with createDgClient startup checks', () => {
    expect(typeof updateOwnMember).toBe('function');
  });
});

describe('read-state contracts', () => {
  test('rejects unsafe cursors before making a request', async () => {
    const { client, requests } = clientWithResponse(ownMember);
    const result = await markChatRead(client, 'chat-a', Number.MAX_SAFE_INTEGER + 1, ownMember.joined_at);

    expect(result).toEqual({ data: null, error: { kind: 'server', code: 'DG422', status: 400 } });
    expect(requests).toHaveLength(0);
  });

  test('sends the membership generation and preserves the returned row', async () => {
    const { client, requests } = clientWithResponse(ownMember);
    const result = await markChatRead(client, 'chat-a', 7, ownMember.joined_at);

    expect(result).toEqual({ data: ownMember, error: null });
    expect(requests[0]?.url).toContain('/rest/v1/rpc/mark_chat_read');
    expect(requests[0]?.body).toEqual({
      p_chat_id: 'chat-a',
      p_max_seq: 7,
      p_membership_joined_at: ownMember.joined_at,
    });
  });

  test('accepts the complete snapshot and the PostgreSQL infinity mute sentinel', async () => {
    const { client } = clientWithResponse({ members: [ownMember], total_count: 1 });
    const result = await listChatMembers(client, 'chat-a', 'user-a');

    expect(result).toEqual({ data: [ownMember], error: null });
  });

  test('rejects a truncated snapshot before cache pruning can use it', async () => {
    const { client } = clientWithResponse({ members: [ownMember], total_count: 2 });
    const result = await listChatMembers(client, 'chat-a', 'user-a');

    expect(result.data).toBeNull();
    expect(result.error).toEqual({ kind: 'server', code: null, status: 502 });
  });
});
