import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { FlatList, ScrollView, SectionList, StyleSheet } from 'react-native';
import { strings, type ChatListItem } from '@dologram/shared';
import SearchScreen from '../../../app/search';
import type { SearchHistoryEntry } from '../history';
import type { SearchPerson } from '../people';
import type { ConversationSummary } from '../query';

/** Role queries can match a container whose descendants repeat a label, so target the exact control. */
function pressLabeled(screen: ReturnType<typeof render>, label: string, index = 0) {
  const matches = screen.getAllByRole('button').filter((node) => node.props.accessibilityLabel === label);
  const target = matches[index < 0 ? matches.length + index : index];
  if (!target) throw new Error(`No button labelled ${label}`);
  fireEvent.press(target);
  return matches.length;
}

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: () => true };
const mockNavigation = { addListener: () => jest.fn(), isFocused: () => true };
const mockShowToast = jest.fn();
const mockReloadChats = jest.fn(async () => undefined);
const mockMessageRetry = jest.fn();
const mockRecord = jest.fn(async () => undefined);
const mockRemoveHistory = jest.fn(async () => undefined);
const mockClearHistory = jest.fn(async () => undefined);
const mockRetryHistory = jest.fn(async () => undefined);
const mockReloadHistory = jest.fn(async () => undefined);
const mockLoadSearchPeople = jest.fn();
const mockLoadSearchGroups = jest.fn();
const mockLoadDirectoryPeople = jest.fn();
const mockOpenDirectChat = jest.fn();

function chatItem(overrides: Partial<ChatListItem> = {}): ChatListItem {
  return {
    chatId: 'chat', title: 'White', preview: 'Hello from history', timeLabel: '', sortMs: 10,
    unreadCount: 0, muted: false, isGroup: false, pinned: false, savedMessages: false,
    avatarId: 'other', avatarName: 'White', ownStatus: null, archived: false, accessibilityLabel: 'White',
    ...overrides,
  };
}

function person(overrides: Partial<SearchPerson> = {}): SearchPerson {
  return {
    kind: 'person', userId: 'other', displayName: 'White', chatId: 'chat', title: 'White',
    aliases: ['White'], sortMs: 10, ...overrides,
  };
}

const mockSummary: ConversationSummary = {
  chatId: 'chat', deliveredMatchCount: 1,
  latestMatch: {
    chatId: 'chat', messageId: 'message', sender: 'You',
    preview: 'Hello from history', createdAt: '2026-11-11T00:00:00Z',
  },
};

let mockChats: ChatListItem[] = [chatItem()];
const mockArchivedChats: ChatListItem[] = [];
const mockIgnoredChats: ChatListItem[] = [];
let mockChatListLoading = false;
let mockChatListError = false;
let mockNet = { isConnected: true };
let mockSearchParams: { category?: string } = {};
let mockPeopleResult: SearchPerson[] = [person()];
let mockMessages: { data: ConversationSummary[]; loading: boolean; error: 'read' | 'timeout' | 'unavailable' | null } = {
  data: [mockSummary], loading: false, error: null,
};
let mockHistory: {
  entries: SearchHistoryEntry[];
  status: 'loading' | 'ready' | 'unavailable' | 'error';
  writeError: boolean;
} = { entries: [], status: 'ready', writeError: false };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useNavigation: () => mockNavigation,
  useLocalSearchParams: () => mockSearchParams,
  useIsFocused: () => true,
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
  useChatList: () => ({
    active: mockChats, archived: mockArchivedChats, ignored: mockIgnoredChats, loading: mockChatListLoading,
    error: mockChatListError, reload: mockReloadChats,
  }),
}));
jest.mock('../../queue/db', () => ({ getLocalDatabase: async () => ({}) }));
jest.mock('../../chats/directChat', () => ({ openDirectChat: (...args: unknown[]) => mockOpenDirectChat(...args) }));
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../lib/ids', () => ({ ids: { chatId: () => 'new-chat' } }));
jest.mock('../../components/Icon', () => ({ Icon: () => null }));
jest.mock('../../components/Avatar', () => ({ Avatar: () => null }));
jest.mock('../../components/Toast', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('../../net/netState', () => ({ useNetState: () => mockNet }));
jest.mock('../people', () => ({
  ...jest.requireActual('../people'),
  loadSearchGroups: (...args: unknown[]) => mockLoadSearchGroups(...args),
  loadSearchPeople: (...args: unknown[]) => mockLoadSearchPeople(...args),
  loadDirectoryPeople: (...args: unknown[]) => mockLoadDirectoryPeople(...args),
}));
jest.mock('../useMessageSearch', () => ({
  useMessageSearch: () => ({ data: mockMessages.data, loading: mockMessages.loading, error: mockMessages.error, retry: mockMessageRetry }),
}));
jest.mock('../history', () => ({
  useSearchHistory: () => ({
    ...mockHistory, record: mockRecord, remove: mockRemoveHistory, clear: mockClearHistory,
    retry: mockRetryHistory, reload: mockReloadHistory,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockChats = [chatItem()];
  mockChatListLoading = false;
  mockChatListError = false;
  mockNet = { isConnected: true };
  mockSearchParams = {};
  mockPeopleResult = [person()];
  mockMessages = { data: [mockSummary], loading: false, error: null };
  mockHistory = { entries: [], status: 'ready', writeError: false };
  mockLoadSearchPeople.mockImplementation(async () => mockPeopleResult);
  mockLoadSearchGroups.mockResolvedValue([]);
  mockLoadDirectoryPeople.mockResolvedValue([]);
  mockOpenDirectChat.mockResolvedValue({ kind: 'created', chatId: 'new-chat' });
});

test.each(['JAMES123', 'jAmEs', 'James Stranger', 'sTrAnGeR'])(
  'finds an unrelated user for %s in All and People and opens a new chat', async (query) => {
    mockChats = [];
    mockPeopleResult = [];
    mockMessages = { data: [], loading: false, error: null };
    mockLoadDirectoryPeople.mockResolvedValue([person({
      kind: 'directory', userId: 'stranger', chatId: null, title: 'James Stranger',
      displayName: 'James Stranger', username: 'james123', aliases: ['James Stranger', 'james123'],
    })]);
    const screen = render(<SearchScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Search'), query);
    await screen.findByRole('button', { name: 'James Stranger, @james123' });
    expect(mockLoadDirectoryPeople).toHaveBeenCalledWith(expect.anything(), 'me', [], query.toLowerCase(), expect.anything());
    fireEvent.press(screen.getByRole('button', { name: 'People' }));
    expect(screen.getByRole('button', { name: 'James Stranger, @james123' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'James Stranger, @james123' }));
    await waitFor(() => expect(mockOpenDirectChat).toHaveBeenCalledWith(expect.objectContaining({ otherUserId: 'stranger' })));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[chatId]', params: { chatId: 'new-chat' } }));
    screen.unmount();
  },
);

test('discards stale directory results after the query changes', async () => {
  let resolveOld: (people: SearchPerson[]) => void = () => undefined;
  mockLoadDirectoryPeople.mockImplementation((_db, _user, _chats, query) => query === 'old'
    ? new Promise<SearchPerson[]>((resolve) => { resolveOld = resolve; }) : Promise.resolve([]));
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'old');
  await waitFor(() => expect(mockLoadDirectoryPeople).toHaveBeenCalled());
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'new');
  await waitFor(() => expect(mockLoadDirectoryPeople).toHaveBeenCalledTimes(2));
  resolveOld([person({ kind: 'directory', title: 'Old', displayName: 'Old' })]);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Old, Old' })).toBeNull());
  screen.unmount();
});

test('renders blank suggestions, opens a known person once, and records that person', async () => {
  const screen = render(<SearchScreen />);
  expect(screen.getByText('Suggested')).toBeTruthy();
  const input = screen.getByPlaceholderText('Search');
  fireEvent.changeText(input, 'white');
  await waitFor(() => expect(screen.getByText('White')).toBeTruthy());
  expect(screen.getAllByText('People').length).toBeGreaterThanOrEqual(1);
  const row = screen.getByRole('button', { name: 'White, White' });
  fireEvent.press(row);
  fireEvent.press(row);
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[chatId]', params: { chatId: 'chat' } });
  expect(mockRecord).toHaveBeenCalledTimes(1);
  expect(mockRecord).toHaveBeenCalledWith({ kind: 'person', id: 'other', selectedAt: expect.any(Number) });
  expect(mockOpenDirectChat).not.toHaveBeenCalled();
  screen.unmount();
});

test('shows a person display name and username together', async () => {
  mockPeopleResult = [person({ username: 'white_user' })];
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'white');
  expect(await screen.findByRole('button', { name: 'White, @white_user' })).toBeTruthy();
  expect(screen.getByText('@white_user')).toBeTruthy();
  screen.unmount();
});

test('groups message matches by conversation and hands the query to scoped search', async () => {
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'hello');
  await waitFor(() => expect(screen.getByText('1 matched message')).toBeTruthy());
  fireEvent.press(screen.getByText('1 matched message'));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[chatId]/search', params: { chatId: 'chat', query: 'hello' } });
  expect(mockRecord).toHaveBeenCalledWith({ kind: 'person', id: 'other', selectedAt: expect.any(Number) });
  screen.unmount();
});

test('ranks Groups by exact, prefix and substring before activity with deterministic ties', async () => {
  mockChats = [
    chatItem({ chatId: 'substring', title: 'The Ada group', isGroup: true, sortMs: 100 }),
    chatItem({ chatId: 'prefix', title: 'Ada group', isGroup: true, sortMs: 90 }),
    chatItem({ chatId: 'exact-b', title: 'Ada', isGroup: true, sortMs: 10 }),
    chatItem({ chatId: 'exact-a', title: 'Ada', isGroup: true, sortMs: 10 }),
  ];
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'ada');
  fireEvent.press(screen.getByRole('button', { name: 'Groups' }));
  const titles = screen.getAllByRole('button').filter((node) => node.props.accessibilityLabel?.includes(', Hello from history'));
  expect(titles.map((node) => node.props.accessibilityLabel)).toEqual([
    'Ada, Hello from history', 'Ada, Hello from history', 'Ada group, Hello from history', 'The Ada group, Hello from history',
  ]);
  fireEvent.press(titles[0]);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[chatId]', params: { chatId: 'exact-a' } });
  screen.unmount();
});

test('Groups includes a chat when a member display name or username matches', async () => {
  mockChats = [chatItem({ chatId: 'group', title: 'Team', isGroup: true })];
  mockMessages = { data: [], loading: false, error: null };
  mockLoadSearchGroups.mockResolvedValue(['group']);
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'ada_123');
  fireEvent.press(screen.getByRole('button', { name: 'Groups' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Team, Hello from history' })).toBeTruthy());
  screen.unmount();
});

test('Groups includes group chats containing matching messages', async () => {
  mockChats = [chatItem({ chatId: 'group', title: 'Team', isGroup: true })];
  mockLoadSearchGroups.mockResolvedValue([]);
  mockMessages = { data: [{ ...mockSummary, chatId: 'group' }], loading: false, error: null };
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'hello');
  fireEvent.press(screen.getByRole('button', { name: 'Groups' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Team, Hello from history' })).toBeTruthy());
  screen.unmount();
});

test('revalidates an existing cached person before opening and preserves offline cached access', async () => {
  mockNet = { isConnected: false };
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'white');
  await waitFor(() => expect(screen.getByRole('button', { name: 'White, White' })).toBeTruthy());
  mockLoadSearchPeople.mockResolvedValueOnce([]);
  fireEvent.press(screen.getByRole('button', { name: 'White, White' }));
  await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith({ message: strings.search.unavailable }));
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(mockOpenDirectChat).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'White, White' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[chatId]', params: { chatId: 'chat' } }));
  expect(mockOpenDirectChat).not.toHaveBeenCalled();
  screen.unmount();
});

test('clearing the field immediately cancels results and restores the blank state', async () => {
  const screen = render(<SearchScreen />);
  const input = screen.getByPlaceholderText('Search');
  fireEvent.changeText(input, 'hello');
  await waitFor(() => expect(screen.getByText('1 matched message')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.queryByText('1 matched message')).toBeNull();
  expect(screen.getByText('Suggested')).toBeTruthy();
  screen.unmount();
});

test('caps All at three rows, exposes See all, and keeps the chosen category while typing', async () => {
  mockPeopleResult = [1, 2, 3, 4].map((index) => person({ userId: `other-${index}`, title: `Ada ${index}`, displayName: `Ada ${index}` }));
  const screen = render(<SearchScreen />);
  const input = screen.getByPlaceholderText('Search');
  fireEvent.changeText(input, 'ada');
  await waitFor(() => expect(screen.getAllByRole('button', { name: /^Ada \d, Ada \d$/ })).toHaveLength(3));
  fireEvent.press(screen.getByRole('button', { name: 'See all' }));
  expect(screen.getAllByRole('button', { name: /^Ada \d, Ada \d$/ })).toHaveLength(4);
  const peopleTab = screen.getByRole('button', { name: 'People' });
  expect(peopleTab.props.accessibilityState).toEqual({ selected: true });
  fireEvent.changeText(input, 'ada 4');
  expect(screen.getByRole('button', { name: 'People' }).props.accessibilityState).toEqual({ selected: true });
  expect(screen.getAllByRole('button', { name: /^Ada \d, Ada \d$/ })).toHaveLength(1);
  screen.unmount();
});

test('switches between empty and loading filters while keeping the same filter controls', async () => {
  mockMessages = { data: [], loading: true, error: null };
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'hello');
  const messages = screen.getByRole('button', { name: 'Messages' });
  const groups = screen.getByRole('button', { name: 'Groups' });
  fireEvent.press(groups);
  expect(await screen.findByText(strings.search.counting)).toBeTruthy();

  fireEvent.press(messages);
  expect(screen.getByText(strings.search.counting)).toBeTruthy();
  expect(screen.queryByText('No results')).toBeNull();
  expect(screen.getByRole('button', { name: 'Groups' })).toBe(groups);

  mockMessages = { data: [mockSummary], loading: false, error: null };
  screen.rerender(<SearchScreen />);
  expect(screen.getByText('1 matched message')).toBeTruthy();
  expect(screen.queryByText(strings.search.counting)).toBeNull();
  expect(screen.getByRole('button', { name: 'Messages' })).toBe(messages);
  expect(messages.props.accessibilityState).toEqual({ selected: true });
  await waitFor(() => expect(mockLoadSearchPeople).toHaveBeenCalled());
});

test('keeps the typed search shell mounted while messages count', async () => {
  mockMessages = { data: [], loading: true, error: null };
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText(strings.search.placeholder), 'hello');

  await waitFor(() => expect(screen.getByText(strings.search.counting)).toBeTruthy());
  expect(screen.getByPlaceholderText(strings.search.placeholder)).toBeTruthy();
  expect(screen.getByRole('button', { name: strings.search.all })).toBeTruthy();
  expect(screen.getByRole('button', { name: strings.search.messages })).toBeTruthy();
  expect(screen.queryByText(strings.search.loadingChats)).toBeNull();
  expect(screen.queryByText('Loading people…')).toBeNull();
  screen.unmount();
});

test('shows a compact no-results CTA that clears the query', async () => {
  mockPeopleResult = [];
  mockMessages = { data: [], loading: false, error: null };
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText(strings.search.placeholder), 'nothing');
  await waitFor(() => expect(screen.getByText(strings.search.emptyResultsTitle)).toBeTruthy());

  const clearButtons = screen.getAllByRole('button', { name: strings.search.clear });
  expect(clearButtons).toHaveLength(2);
  expect(screen.queryByRole('button', { name: 'Search username' })).toBeNull();

  fireEvent.press(clearButtons[1]);
  expect(screen.getByText(strings.search.suggested)).toBeTruthy();
  screen.unmount();
});

test('keeps the filter row geometry fixed while the search input owns the keyboard', () => {
  const screen = render(<SearchScreen />);
  const filterBar = screen.UNSAFE_getAllByType(ScrollView).find((node) => StyleSheet.flatten(node.props.style)?.height === 60);

  expect(filterBar).toBeTruthy();
  expect(filterBar?.props.keyboardShouldPersistTaps).toBe('handled');
  expect(screen.getByRole('search').props.returnKeyType).toBe('search');
  screen.unmount();
});

test('keeps global result lists virtualized with bounded render batches', async () => {
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText(strings.search.placeholder), 'hello');
  await waitFor(() => expect(screen.getByText('1 matched message')).toBeTruthy());
  const sections = screen.UNSAFE_getByType(SectionList);
  expect(sections.props.initialNumToRender).toBe(8);
  expect(sections.props.maxToRenderPerBatch).toBe(8);
  expect(sections.props.windowSize).toBe(7);
  expect(sections.props.removeClippedSubviews).toBeUndefined();

  fireEvent.press(screen.getByRole('button', { name: strings.search.people }));
  const people = await waitFor(() => screen.UNSAFE_getByType(FlatList));
  expect(people.props.initialNumToRender).toBe(8);
  expect(people.props.maxToRenderPerBatch).toBe(8);
  expect(people.props.windowSize).toBe(7);
  expect(people.props.removeClippedSubviews).toBeUndefined();
  screen.unmount();
});

test('keeps the search shell stable with a compact initial chat skeleton', () => {
  mockChatListLoading = true;
  mockChats = [];
  const screen = render(<SearchScreen />);
  expect(screen.getByRole('progressbar', { name: strings.search.loadingChats })).toBeTruthy();
  expect(screen.queryByText('Suggested')).toBeNull();
  expect(screen.getByPlaceholderText(strings.search.placeholder)).toBeTruthy();
  expect(screen.getByRole('button', { name: strings.search.messages })).toBeTruthy();
  screen.unmount();
});

test('reports people and message failures independently and retries each', async () => {
  mockLoadSearchPeople.mockRejectedValue(new Error('cache failed'));
  mockMessages = { data: [], loading: false, error: 'read' };
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'ada');
  await waitFor(() => expect(screen.getByText(strings.search.historyLoadFailed)).toBeTruthy());
  expect(screen.getByText(strings.search.failed)).toBeTruthy();
  const calls = mockLoadSearchPeople.mock.calls.length;
  fireEvent.press(screen.getAllByRole('button', { name: 'Retry' })[0]);
  await waitFor(() => expect(mockLoadSearchPeople.mock.calls.length).toBe(calls + 1));
  expect(mockMessageRetry).not.toHaveBeenCalled();
  fireEvent.press(screen.getAllByRole('button', { name: 'Retry' })[1]);
  expect(mockMessageRetry).toHaveBeenCalledTimes(1);
  screen.unmount();
});

test('offline group-only person reports no connection without creating a chat', async () => {
  mockNet = { isConnected: false };
  mockPeopleResult = [person({ chatId: null })];
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'white');
  await waitFor(() => expect(screen.getByRole('button', { name: 'White, White' })).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'White, White' }));
  await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith({ message: strings.common.noConnection }));
  expect(mockOpenDirectChat).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
  screen.unmount();
});

test('creates a missing direct chat once, then blocks repeated taps', async () => {
  mockPeopleResult = [person({ chatId: null })];
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'white');
  await waitFor(() => expect(screen.getByRole('button', { name: 'White, White' })).toBeTruthy());
  const row = screen.getByRole('button', { name: 'White, White' });
  fireEvent.press(row);
  fireEvent.press(row);
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[chatId]', params: { chatId: 'new-chat' } }));
  expect(mockOpenDirectChat).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  screen.unmount();
});

test('a failed eligibility preflight creates nothing and releases the opening guard', async () => {
  mockPeopleResult = [person({ chatId: null })];
  const screen = render(<SearchScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('Search'), 'white');
  await waitFor(() => expect(screen.getByRole('button', { name: 'White, White' })).toBeTruthy());
  mockLoadSearchPeople.mockRejectedValueOnce(new Error('cache failed'));
  fireEvent.press(screen.getByRole('button', { name: 'White, White' }));
  await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith({ message: strings.newChat.openFailed }));
  expect(mockOpenDirectChat).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'White, White' }));
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1));
  expect(mockOpenDirectChat).toHaveBeenCalledTimes(1);
  screen.unmount();
});

test('renders the recent rail and supports edit removal', async () => {
  mockHistory = { entries: [{ kind: 'person', id: 'other', selectedAt: 5 }], status: 'ready', writeError: false };
  const screen = render(<SearchScreen />);
  await waitFor(() => expect(screen.getByText('Recent searches')).toBeTruthy());
  await waitFor(() => pressLabeled(screen, 'Edit'));
  await waitFor(() => expect(pressLabeled(screen, 'Remove White')).toBe(1));
  await waitFor(() => expect(mockRemoveHistory).toHaveBeenCalledWith(expect.objectContaining({ kind: 'person', id: 'other' })));
  pressLabeled(screen, 'Done');
  expect(screen.getAllByRole('button').filter((node) => node.props.accessibilityLabel === 'Edit').length).toBe(1);
  screen.unmount();
});

test('confirms clear all before removing recent searches', async () => {
  mockHistory = { entries: [{ kind: 'person', id: 'other', selectedAt: 5 }], status: 'ready', writeError: false };
  const screen = render(<SearchScreen />);
  await waitFor(() => expect(screen.getByText('Recent searches')).toBeTruthy());
  await waitFor(() => pressLabeled(screen, 'Clear all'));
  expect(mockClearHistory).not.toHaveBeenCalled();
  pressLabeled(screen, 'Clear all', -1);
  await waitFor(() => expect(mockClearHistory).toHaveBeenCalledTimes(1));
  screen.unmount();
});

test('shows a retry for a failed history load and a notice for unavailable history', async () => {
  mockHistory = { entries: [], status: 'error', writeError: false };
  const failed = render(<SearchScreen />);
  expect(failed.getAllByText(strings.search.historyLoadFailed).length).toBeGreaterThanOrEqual(1);
  fireEvent.press(failed.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(mockRetryHistory).toHaveBeenCalledTimes(1));
  failed.unmount();

  mockHistory = { entries: [], status: 'unavailable', writeError: false };
  const unavailable = render(<SearchScreen />);
  expect(unavailable.getByText(strings.search.historyUnavailable)).toBeTruthy();
  expect(unavailable.queryByRole('button', { name: strings.search.clearHistory })).toBeNull();
  expect(unavailable.getByRole('button', { name: strings.search.resetHistory })).toBeTruthy();
  unavailable.unmount();
});

test('keeps the suggested heading out of explicit history edit mode', async () => {
  mockHistory = { entries: [{ kind: 'person', id: 'other', selectedAt: 5 }], status: 'ready', writeError: false };
  const screen = render(<SearchScreen />);
  await waitFor(() => expect(screen.getByText(strings.search.suggested)).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: strings.search.edit }));
  expect(screen.queryByText(strings.search.suggested)).toBeNull();
  expect(screen.getByRole('button', { name: strings.search.done })).toBeTruthy();
  screen.unmount();
});

test('keeps a stable history placeholder until loading settles', () => {
  mockHistory = { entries: [], status: 'loading', writeError: false };
  const screen = render(<SearchScreen />);
  expect(screen.getByRole('progressbar', { name: strings.search.loadingHistory })).toBeTruthy();
  expect(screen.queryByText(strings.search.noHistory)).toBeNull();

  mockHistory = { entries: [], status: 'ready', writeError: false };
  screen.rerender(<SearchScreen />);
  expect(screen.getByText(strings.search.noHistory)).toBeTruthy();
  expect(screen.queryByRole('progressbar', { name: strings.search.loadingHistory })).toBeNull();
  screen.unmount();
});

test('keeps the durable list and offers retry after a failed history write', async () => {
  mockHistory = { entries: [{ kind: 'person', id: 'other', selectedAt: 5 }], status: 'ready', writeError: true };
  const screen = render(<SearchScreen />);
  await waitFor(() => expect(screen.getByText(strings.search.historyWriteFailed)).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(mockRetryHistory).toHaveBeenCalledTimes(1));
  screen.unmount();
});
