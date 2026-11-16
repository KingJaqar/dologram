import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatListSourceRow } from '@dologram/shared';
import { useChatList } from '../useChatList';
import { loadChatListRows } from '../query';
import { setChatListPreference } from '../preferences';
import { CHAT_LIST_SNAPSHOT_PREFIX, recentRowsByUser, clearChatListSnapshots } from '../startupSnapshot';

let mockUserId = 'list-user';
let mockBlockedChatIds = new Set<string>();
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => {
  const React = jest.requireActual('react');
  React.useEffect(callback, [callback]);
} }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: mockUserId } } }) }));
jest.mock('../../queue/db', () => ({ getLocalDatabase: async () => ({}) }));
jest.mock('../../sync/lifecycle', () => ({ resyncNow: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../chats/preferences', () => ({ loadBlockedChatIds: async () => mockBlockedChatIds }));
jest.mock('../query', () => ({ loadChatListRows: jest.fn() }));

function row(id: string, archived = false): ChatListSourceRow {
  return {
    chat: { chat_id: id, type: 'direct', title: null, direct_key: id, next_seq: 1, created_by: mockUserId, created_at: '2026-11-01T00:00:00Z' },
    myMember: { chat_id: id, user_id: mockUserId, archived, role: 'member', joined_at: '2026-11-01T00:00:00Z', last_read_seq: 0, muted_until: null },
    lastMessage: null, lastMediaType: null, lastSenderName: null, otherMemberId: 'other', otherMemberName: id, otherMaxReadSeq: 0, unreadCount: 0,
  };
}

beforeEach(async () => { await clearChatListSnapshots(); await AsyncStorage.clear(); jest.clearAllMocks(); mockUserId = 'list-user'; mockBlockedChatIds = new Set(); });

test('cold launch shows saved chats before SQLite completes, then replaces them with fresh rows', async () => {
  const snapshot = { userId: mockUserId, rows: [row('saved-offline')], blockedRows: [], preferences: { pinned: [], ignored: [], unread: [], deleted: [] } };
  await AsyncStorage.setItem(CHAT_LIST_SNAPSHOT_PREFIX + mockUserId, JSON.stringify(snapshot));
  let finish!: (rows: ChatListSourceRow[]) => void;
  jest.mocked(loadChatListRows).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(() => useChatList());
  await waitFor(() => expect(result.current.active[0]?.chatId).toBe('saved-offline'));
  expect(result.current.loading).toBe(false);
  await act(async () => { finish([row('fresh')]); });
  expect(result.current.active[0]?.chatId).toBe('fresh');
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(CHAT_LIST_SNAPSHOT_PREFIX + mockUserId))!).rows[0].chat.chat_id).toBe('fresh'));
});

test('a slow startup snapshot cannot overwrite fresh database rows', async () => {
  const snapshot = { userId: mockUserId, rows: [row('stale')], blockedRows: [], preferences: { pinned: [], ignored: [], unread: [], deleted: [] } };
  let finish!: (value: string) => void;
  jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  jest.mocked(loadChatListRows).mockResolvedValue([row('fresh')]);
  const { result } = renderHook(() => useChatList());
  await waitFor(() => expect(result.current.active[0]?.chatId).toBe('fresh'));
  await act(async () => { finish(JSON.stringify(snapshot)); });
  expect(result.current.active[0]?.chatId).toBe('fresh');
  jest.restoreAllMocks();
});

test('cleanup prevents a pending database read from repopulating startup snapshots', async () => {
  let finish!: (rows: ChatListSourceRow[]) => void;
  jest.mocked(loadChatListRows).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const screen = renderHook(() => useChatList());
  await waitFor(() => expect(finish).toBeDefined());
  screen.unmount();
  await clearChatListSnapshots();
  await act(async () => { finish([row('private')]); });
  expect(recentRowsByUser.size).toBe(0);
  expect(await AsyncStorage.getItem(CHAT_LIST_SNAPSHOT_PREFIX + mockUserId)).toBeNull();
});

test('saved offline chats remain usable when the database read fails', async () => {
  await AsyncStorage.setItem(CHAT_LIST_SNAPSHOT_PREFIX + mockUserId, JSON.stringify({
    userId: mockUserId, rows: [row('offline')], blockedRows: [],
    preferences: { pinned: [], ignored: [], unread: [], deleted: [] },
  }));
  jest.mocked(loadChatListRows).mockRejectedValueOnce(new Error('database busy'));
  const { result } = renderHook(() => useChatList());
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.active[0]?.chatId).toBe('offline');
  expect(result.current.loading).toBe(false);
});

test('header and list both hydrate while sharing a single database read', async () => {
  await AsyncStorage.setItem(CHAT_LIST_SNAPSHOT_PREFIX + mockUserId, JSON.stringify({
    userId: mockUserId, rows: [row('saved')], blockedRows: [],
    preferences: { pinned: [], ignored: [], unread: [], deleted: [] },
  }));
  let finish!: (rows: ChatListSourceRow[]) => void;
  jest.mocked(loadChatListRows).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(() => [useChatList(), useChatList()]);
  await waitFor(() => {
    expect(result.current[0].active[0]?.chatId).toBe('saved');
    expect(result.current[1].active[0]?.chatId).toBe('saved');
  });
  expect(loadChatListRows).toHaveBeenCalledTimes(1);
  await act(async () => { finish([row('fresh')]); });
  expect(result.current.every((list) => list.active[0]?.chatId === 'fresh')).toBe(true);
});

test.each(['{broken', JSON.stringify({ userId: 'someone-else', rows: [], blockedRows: [] })])(
  'invalid startup data falls back to the local query: %s', async (value) => {
    await AsyncStorage.setItem(CHAT_LIST_SNAPSHOT_PREFIX + mockUserId, value);
    jest.mocked(loadChatListRows).mockResolvedValue([row('local')]);
    const { result } = renderHook(() => useChatList());
    await waitFor(() => expect(result.current.active[0]?.chatId).toBe('local'));
  },
);

test('keeps blocked chats out of organized lists while exposing them separately', async () => {
  mockBlockedChatIds.add('blocked-archived');
  jest.mocked(loadChatListRows).mockResolvedValue([row('active'), row('blocked-archived', true)]);
  const { result } = renderHook(() => useChatList());
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.active.map((item) => item.chatId)).toEqual(['active']);
  expect(result.current.archived).toEqual([]);
  expect(result.current.blocked.map((item) => item.chatId)).toEqual(['blocked-archived']);
});

test('ignore and restore update mounted lists immediately, preserving archive state', async () => {
  jest.mocked(loadChatListRows).mockResolvedValue([row('active'), row('archived', true)]);
  const { result } = renderHook(() => useChatList());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await setChatListPreference(mockUserId, 'active', 'ignored', true);
    await setChatListPreference(mockUserId, 'archived', 'ignored', true);
  });
  await waitFor(() => expect(result.current.ignored).toHaveLength(2));
  expect(result.current.active).toEqual([]);
  expect(result.current.archived).toEqual([]);
  await act(async () => { await setChatListPreference(mockUserId, 'archived', 'ignored', false); });
  await waitFor(() => expect(result.current.archived.map((item) => item.chatId)).toEqual(['archived']));
  expect(result.current.ignored.map((item) => item.chatId)).toEqual(['active']);
});

test('stars update before storage or a database refresh finishes and failed saves restore the icon', async () => {
  jest.mocked(loadChatListRows).mockResolvedValue([row('chat')]);
  const { result } = renderHook(() => useChatList());
  await waitFor(() => expect(result.current.active[0]?.pinned).toBe(false));
  const write = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
  let rejectSave!: (error: Error) => void;
  jest.mocked(AsyncStorage.setItem).mockImplementation((key, value) => key === 'dg.chatListPreferences'
    ? new Promise((_, reject) => { rejectSave = reject; })
    : write(key, value));
  let request!: Promise<unknown>;
  act(() => { request = setChatListPreference(mockUserId, 'chat', 'pinned', true).catch(() => undefined); });
  expect(result.current.active[0]?.pinned).toBe(true);
  await waitFor(() => expect(rejectSave).toBeDefined());
  await act(async () => { rejectSave(new Error('storage failed')); await request; });
  expect(result.current.active[0]?.pinned).toBe(false);
  jest.mocked(AsyncStorage.setItem).mockImplementation(write);
});

test('star then unstar stay current while the list database refresh is stalled', async () => {
  mockUserId = 'instant-star';
  jest.mocked(loadChatListRows).mockResolvedValue([row('chat')]);
  const { result } = renderHook(() => useChatList());
  await waitFor(() => expect(result.current.active[0]?.pinned).toBe(false));
  jest.mocked(loadChatListRows).mockImplementation(() => new Promise(() => {}));
  await act(async () => { await setChatListPreference(mockUserId, 'chat', 'pinned', true); });
  expect(result.current.active[0]?.pinned).toBe(true);
  await act(async () => { await setChatListPreference(mockUserId, 'chat', 'pinned', false); });
  expect(result.current.active[0]?.pinned).toBe(false);
});

test('account switch can load while the previous account read is still pending', async () => {
  mockUserId = 'slow-user';
  let finishOld!: (rows: ChatListSourceRow[]) => void;
  jest.mocked(loadChatListRows).mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
  const { result, rerender } = renderHook(() => useChatList());
  await waitFor(() => expect(loadChatListRows).toHaveBeenCalledTimes(1));
  const oldRows = [row('old-private')];
  mockUserId = 'new-user';
  jest.mocked(loadChatListRows).mockResolvedValue([row('new-private')]);
  rerender({});
  await waitFor(() => expect(result.current.active.map((item) => item.chatId)).toEqual(['new-private']));
  await act(async () => { finishOld(oldRows); });
  expect(result.current.active.map((item) => item.chatId)).toEqual(['new-private']);
});

test('returning to a list keeps cached content visible during reload and on failure', async () => {
  mockUserId = 'cached-navigation';
  jest.mocked(loadChatListRows).mockResolvedValue([row('cached'), row('archive', true)]);
  const first = renderHook(() => useChatList());
  await waitFor(() => expect(first.result.current.loading).toBe(false));
  first.unmount();
  let fail!: (error: Error) => void;
  jest.mocked(loadChatListRows).mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  const next = renderHook(() => useChatList());
  expect(next.result.current.loading).toBe(false);
  expect(next.result.current.active[0].chatId).toBe('cached');
  expect(next.result.current.archived[0].chatId).toBe('archive');
  await waitFor(() => expect(fail).toBeDefined());
  await act(async () => { fail(new Error('read failed')); });
  expect(next.result.current.error).toBe(true);
  expect(next.result.current.loading).toBe(false);
  expect(next.result.current.active[0].chatId).toBe('cached');
});

test('a failed read from the previous account does not suppress loading for a new account', async () => {
  mockUserId = 'failed-account';
  jest.mocked(loadChatListRows).mockRejectedValueOnce(new Error('read failed'));
  const { result, rerender } = renderHook(() => useChatList());
  await waitFor(() => expect(result.current.error).toBe(true));
  mockUserId = 'pending-account';
  let finish!: (rows: ChatListSourceRow[]) => void;
  jest.mocked(loadChatListRows).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  rerender({});
  expect(result.current.error).toBe(false);
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(finish).toBeDefined());
  await act(async () => { finish([row('new')]); });
  expect(result.current.loading).toBe(false);
});
