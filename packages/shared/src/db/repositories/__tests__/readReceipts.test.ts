import { createDgClient, type DgClient } from '../../client';
import {
  getMessageReadParticipants,
  getMyReadPrivacy,
  setMyReadPrivacy,
} from '../readReceipts';

const storage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

function clientWithResponses(...responses: unknown[]): {
  client: DgClient;
  requests: Array<{ url: string; body: unknown }>;
} {
  const requests: Array<{ url: string; body: unknown }> = [];
  let responseIndex = 0;
  const client = createDgClient({
    url: 'https://dologram.example',
    key: 'test-key',
    storage,
    fetch: async (input, init) => {
      const bodyText = typeof init?.body === 'string' ? init.body : null;
      requests.push({ url: String(input), body: bodyText === null ? null : JSON.parse(bodyText) as unknown });
      const response = responses[responseIndex];
      responseIndex += 1;
      return Response.json(response);
    },
  });
  return { client, requests };
}

describe('read receipt repository', () => {
  test('preserves the available roster and nullable privacy-limited times', async () => {
    const payload = {
      state: 'available',
      expires_at: '2026-11-21T00:00:00.000Z',
      participants: [
        {
          user_id: 'user-b',
          display_name: 'Bob',
          avatar_url: null,
          read_at: '2026-11-14T00:00:00.000Z',
        },
        {
          user_id: 'user-c',
          display_name: 'Carol',
          avatar_url: 'avatars/user-c.jpg',
          read_at: null,
        },
      ],
    };
    const { client, requests } = clientWithResponses(payload);

    await expect(getMessageReadParticipants(client, 'chat-a', 'message-a'))
      .resolves.toEqual({ data: payload, error: null });
    expect(requests[0]?.url).toContain('/rest/v1/rpc/get_message_read_participants');
    expect(requests[0]?.body).toEqual({ p_chat_id: 'chat-a', p_message_id: 'message-a' });
  });

  test('keeps not-recorded distinct from an available empty roster', async () => {
    const { client } = clientWithResponses(
      { state: 'not_recorded' },
      { state: 'available', participants: [], expires_at: '2026-11-21T00:00:00.000Z' },
    );

    await expect(getMessageReadParticipants(client, 'chat-a', 'message-a'))
      .resolves.toEqual({ data: { state: 'not_recorded' }, error: null });
    await expect(getMessageReadParticipants(client, 'chat-a', 'message-b'))
      .resolves.toEqual({
        data: { state: 'available', participants: [], expires_at: '2026-11-21T00:00:00.000Z' },
        error: null,
      });
  });

  test('rejects malformed and duplicate participant data', async () => {
    const { client } = clientWithResponses({
      state: 'available',
      expires_at: '2026-11-21T00:00:00.000Z',
      participants: [
        { user_id: 'user-b', display_name: 'Bob', avatar_url: null, read_at: null },
        { user_id: 'user-b', display_name: 'Bob', avatar_url: null, read_at: null },
      ],
    });

    const result = await getMessageReadParticipants(client, 'chat-a', 'message-a');
    expect(result).toEqual({ data: null, error: { kind: 'server', code: null, status: 502 } });
  });

  test('gets the default contract and sends only an approved privacy value', async () => {
    const { client, requests } = clientWithResponses('everyone', 'nobody');

    await expect(getMyReadPrivacy(client)).resolves.toEqual({ data: 'everyone', error: null });
    await expect(setMyReadPrivacy(client, 'nobody')).resolves.toEqual({ data: 'nobody', error: null });
    expect(requests[1]?.body).toEqual({ p_read_time_visibility: 'nobody' });
  });
});
