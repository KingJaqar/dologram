import type { DgClient } from '@dologram/shared';
import { createSupabaseDelivery } from '../source';

type Payload = { new: unknown; old: unknown };
type FakeChannel = {
  on: (kind: string, filter: { table: string }, handler: (payload: Payload) => void) => FakeChannel;
  subscribe: () => FakeChannel;
};

test('member delivery invalidates malformed rows and only publishes validated server state', () => {
  const handlers = new Map<string, (payload: Payload) => void>();
  const channel = {} as FakeChannel;
  channel.on = jest.fn((_kind: string, filter: { table: string }, handler: (payload: Payload) => void): FakeChannel => {
    handlers.set(filter.table, handler);
    return channel;
  });
  channel.subscribe = jest.fn((): FakeChannel => channel);
  const client = {
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(async () => 'ok'),
  } as unknown as DgClient;
  const onChange = jest.fn();
  const onMembersInvalidated = jest.fn();
  const stop = createSupabaseDelivery(client).subscribe({
    onChange,
    onMembersInvalidated,
    onStatus: jest.fn(),
  });
  const memberEvent = handlers.get('chat_members');
  expect(memberEvent).toBeDefined();

  memberEvent?.({
    new: {
      chat_id: 'chat-a', user_id: 'user-a', joined_at: '2026-11-14T00:00:00Z', role: 'member',
      last_read_seq: 1.5, archived: false, muted_until: null, nickname: null,
    },
    old: { chat_id: 'chat-a' },
  });
  expect(onMembersInvalidated).toHaveBeenCalledWith('chat-a');
  expect(onChange).not.toHaveBeenCalled();

  memberEvent?.({
    new: {
      chat_id: 'chat-a', user_id: 'user-a', joined_at: '2026-11-14T00:00:00Z', role: 'member',
      last_read_seq: 4, archived: false, muted_until: null, nickname: null,
    },
    old: {},
  });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    table: 'chat_members',
    row: expect.objectContaining({ chat_id: 'chat-a', user_id: 'user-a', last_read_seq: 4 }),
  }));

  stop();
  expect(client.removeChannel).toHaveBeenCalledWith(channel);
});
