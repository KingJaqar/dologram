import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useChatInfo } from '../useChatInfo';
import { loadChatInfoSource } from '../infoQuery';

let mockUserId = 'me';
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]) }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: mockUserId } } }) }));
jest.mock('../../queue/db', () => ({ getLocalDatabase: async () => ({}) }));
jest.mock('../../sync/lifecycle', () => ({ resyncNow: jest.fn() }));
jest.mock('../infoQuery', () => ({ loadChatInfoSource: jest.fn() }));

function source(id: string) {
  return {
    chat: { chat_id: id, type: 'group' as const, title: id, direct_key: null, next_seq: 1, created_by: 'me', created_at: '2026-11-01' },
    members: [{ chat_id: id, user_id: mockUserId, archived: false, role: 'member', joined_at: '2026-11-01', last_read_seq: 0, muted_until: null }],
    profiles: [],
  };
}
type Source = ReturnType<typeof source>;
beforeEach(() => { jest.clearAllMocks(); mockUserId = 'me'; });

test('changing chats while a read is pending loads the new chat and rejects the stale result', async () => {
  let finishOld!: (value: Source) => void;
  jest.mocked(loadChatInfoSource).mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
  const { result, rerender } = renderHook(({ id }: { id: string }) => useChatInfo(id), { initialProps: { id: 'old' } });
  await waitFor(() => expect(loadChatInfoSource).toHaveBeenCalledTimes(1));
  jest.mocked(loadChatInfoSource).mockResolvedValue(source('new'));
  rerender({ id: 'new' });
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.info?.chatId).toBe('new'));
  await act(async () => { finishOld(source('old')); });
  expect(result.current.info?.chatId).toBe('new');
});

test('confirmed archive state cannot be overwritten by an older cache read', async () => {
  jest.mocked(loadChatInfoSource).mockResolvedValue(source('chat'));
  const { result } = renderHook(() => useChatInfo('chat'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  let finishRead!: (value: Source) => void;
  jest.mocked(loadChatInfoSource).mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }));
  let pending!: Promise<void>;
  act(() => { pending = result.current.reload(); });
  await waitFor(() => expect(loadChatInfoSource).toHaveBeenCalledTimes(2));
  act(() => { result.current.applyMember({ ...source('chat').members[0], archived: true }); });
  await act(async () => { finishRead(source('chat')); await pending; });
  expect(result.current.info?.archived).toBe(true);
});
