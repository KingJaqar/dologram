import { act, renderHook } from '@testing-library/react-native';
import { strings, type ChatListItem } from '@dologram/shared';
import { useChatSwipeMutations } from '../ChatSwipeActions';
import { setChatListPreference } from '../preferences';

const mockToast = jest.fn();
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../../net/netState', () => ({ useNetState: () => ({ isConnected: true }) }));
jest.mock('../../components/Toast', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../queue/db', () => ({ getLocalDatabase: jest.fn() }));
jest.mock('../preferences', () => ({ setChatListPreference: jest.fn() }));
jest.mock('../../theme/ThemeProvider', () => ({ useTheme: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); });

test.each([false, true])('star toggle from pinned=%s emits the correct success and error toast', async (pinned) => {
  const item = { chatId: 'chat', pinned } as ChatListItem;
  const action = pinned ? 'unstarChat' : 'starChat';
  const { result } = renderHook(() => useChatSwipeMutations(jest.fn()));
  jest.mocked(setChatListPreference).mockResolvedValue({ pinned: [], ignored: [], unread: [], deleted: [] });
  await act(async () => { await result.current.execute([{ item, action: 'star', section: 'chats' }]); });
  expect(setChatListPreference).toHaveBeenCalledWith('me', 'chat', 'pinned', !pinned);
  expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ message: strings.toasts.actions[action].success }));
  jest.mocked(setChatListPreference).mockRejectedValueOnce(new Error('storage failed'));
  await act(async () => { await result.current.execute([{ item, action: 'star', section: 'chats' }]); });
  expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ message: strings.toasts.actions[action].error }));
});
