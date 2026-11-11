import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ChatListItem } from '@dologram/shared';
import SearchScreen from '../../../app/search';
import { searchCachedMessages, type MessageMatch } from '../query';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
const mockChats = [{
  chatId: 'chat', title: 'White', preview: 'Hello', timeLabel: '', sortMs: 0,
  unreadCount: 0, muted: false, isGroup: false, pinned: false, savedMessages: false,
  avatarId: 'other', avatarName: 'White', ownStatus: null, archived: false, accessibilityLabel: 'White',
}] satisfies ChatListItem[];

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../../theme/ThemeProvider', () => ({
  useTheme: () => {
    const tokens = jest.requireActual('@dologram/shared');
    return { ...tokens, colors: tokens.color.light, duration: () => 0, reduceMotion: true };
  },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../chatList/useChatList', () => ({
  useChatList: () => ({ active: mockChats, archived: [], ignored: [], loading: false, error: false, reload: jest.fn() }),
}));
jest.mock('../../queue/db', () => ({ getLocalDatabase: async () => ({}) }));
jest.mock('../../components/Icon', () => ({ Icon: () => null }));
jest.mock('../../components/Avatar', () => ({ Avatar: () => null }));
jest.mock('../query', () => ({ ...jest.requireActual('../query'), searchCachedMessages: jest.fn() }));

const match: MessageMatch = {
  chatId: 'chat', messageId: 'message', sender: 'You',
  preview: 'Hello from history', createdAt: '2026-11-11T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(searchCachedMessages).mockResolvedValue({ matches: [match], next: null });
});

test('filters conversations, clears immediately, and opens the selected chat', async () => {
  const screen = render(<SearchScreen />);
  const input = screen.getByPlaceholderText('Search chats and messages');
  fireEvent.changeText(input, 'white');
  expect(screen.getByText('White')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
  expect(input.props.value).toBe('');
  expect(screen.getByText('Search DoloGram')).toBeTruthy();
  fireEvent.changeText(input, 'white');
  fireEvent.press(screen.getByRole('button', { name: 'White' }));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[chatId]', params: { chatId: 'chat' } });
  await act(async () => undefined);
});

test('opens a message result with its focus target and preserves search on the back stack', async () => {
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search chats and messages'), 'hello');
  await waitFor(() => expect(screen.getByText(match.preview)).toBeTruthy());
  fireEvent.press(screen.getByText(match.preview));
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/chat/[chatId]', params: { chatId: 'chat', focusMessageId: 'message' },
  });
});

test('drops results from a previous query and retries a failed search', async () => {
  let resolveOld!: (page: { matches: MessageMatch[]; next: null }) => void;
  jest.mocked(searchCachedMessages).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const screen = render(<SearchScreen />);
  const input = screen.getByPlaceholderText('Search chats and messages');
  fireEvent.changeText(input, 'old');
  await waitFor(() => expect(searchCachedMessages).toHaveBeenCalledTimes(1));
  jest.mocked(searchCachedMessages).mockRejectedValueOnce(new Error('database unavailable'));
  fireEvent.changeText(input, 'new');
  await act(async () => { resolveOld({ matches: [{ ...match, preview: 'Stale result' }], next: null }); });
  await waitFor(() => expect(screen.getByText("Couldn't search messages.")).toBeTruthy());
  expect(screen.queryByText('Stale result')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByText(match.preview)).toBeTruthy());
});
