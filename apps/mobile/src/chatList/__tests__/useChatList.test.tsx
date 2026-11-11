import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatListSourceRow } from '@dologram/shared';
import { useChatList } from '../useChatList';
import { loadChatListRows } from '../query';
import { setChatListPreference } from '../preferences';

let mockUserId = 'list-user';
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => {
  const React = jest.requireActual('react');
  React.useEffect(callback, [callback]);
} }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: mockUserId } } }) }));
jest.mock('../../queue/db', () => ({ getLocalDatabase: async () => ({}) }));
jest.mock('../../sync/lifecycle', () => ({ resyncNow: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../chats/preferences', () => ({ loadChatPreferences: async () => ({ blocked: false }) }));
jest.mock('../query', () => ({ loadChatListRows: jest.fn() }));

function row(id: string, archived = false): ChatListSourceRow {
  return {
    chat: { chat_id: id, type: 'direct', title: null, direct_key: id, next_seq: 1, created_by: mockUserId, created_at: '2026-11-01T00:00:00Z' },
    myMember: { chat_id: id, user_id: mockUserId, archived, role: 'member', joined_at: '2026-11-01T00:00:00Z', last_read_seq: 0, muted_until: null },
    lastMessage: null, lastMediaType: null, lastSenderName: null, otherMemberId: 'other', otherMemberName: id, otherMaxReadSeq: 0, unreadCount: 0,
  };
}

beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); mockUserId = 'list-user'; });

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
