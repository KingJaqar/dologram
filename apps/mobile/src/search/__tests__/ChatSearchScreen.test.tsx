import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { strings } from '@dologram/shared';
import ChatSearchScreen from '../../../app/chat/[chatId]/search';
import type { MessageMatch, SearchCursor } from '../query';

type ScopedResultPage = { matches: MessageMatch[]; pendingMatches: MessageMatch[]; next: SearchCursor | null };
type MockSearchResult = {
  data: ScopedResultPage | null;
  loading: boolean;
  error: 'read' | 'timeout' | 'unavailable' | null;
  epoch: number;
  retry: () => void;
};

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
const mockNavigation = { addListener: () => jest.fn(), isFocused: () => true };
const mockSearch: MockSearchResult = {
  data: {
    matches: [{ chatId: 'chat', messageId: 'message', createdAt: '2026-11-11T00:00:00Z', sender: 'Other', preview: 'needle in context', sources: ['content'] }],
    pendingMatches: [],
    next: null,
  },
  loading: false,
  error: null,
  epoch: 0,
  retry: jest.fn(),
};
const mockUseMessageSearch = jest.fn((..._args: unknown[]) => mockSearch);
const mockScopedPage = jest.fn(async () => ({ matches: [] as MessageMatch[], pendingMatches: [] as MessageMatch[], next: null as SearchCursor | null }));

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useNavigation: () => mockNavigation,
  useIsFocused: () => true,
  useLocalSearchParams: () => ({ chatId: 'chat', query: 'needle' }),
}));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../../theme/ThemeProvider', () => ({
  useTheme: () => {
    const tokens = jest.requireActual('@dologram/shared');
    return { ...tokens, colors: tokens.color.light, duration: () => 0, reduceMotion: true };
  },
}));
jest.mock('../../queue/db', () => ({ getLocalDatabase: async () => ({}) }));
jest.mock('../../queue/localQueue', () => ({ getUnsentItems: async () => [] }));
jest.mock('../../chat/query', () => ({ loadChatSnapshot: async () => ({ title: 'Group' }) }));
jest.mock('../query', () => ({ searchScopedMessages: () => mockScopedPage() }));
jest.mock('../useMessageSearch', () => ({ useMessageSearch: (...args: unknown[]) => mockUseMessageSearch(...args) }));
jest.mock('../../components/Icon', () => ({ Icon: () => null }));
jest.mock('../../components/TopBar', () => ({
  TopBar: ({ title, onBack }: { title: string; onBack: () => void }) => {
    const ReactNative = jest.requireActual('react-native');
    const ReactRuntime = jest.requireActual('react');
    return ReactRuntime.createElement(ReactNative.Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Back', onPress: onBack }, ReactRuntime.createElement(ReactNative.Text, null, title));
  },
}));
jest.mock('../../components/EmptyState', () => ({ EmptyState: () => null }));
jest.mock('../../components/Button', () => ({
  Button: ({ label, onPress }: { label: string; onPress: () => void }) => {
    const ReactNative = jest.requireActual('react-native');
    const ReactRuntime = jest.requireActual('react');
    return ReactRuntime.createElement(ReactNative.Pressable, { accessibilityRole: 'button', accessibilityLabel: label, onPress }, ReactRuntime.createElement(ReactNative.Text, null, label));
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMessageSearch.mockReturnValue(mockSearch);
  mockScopedPage.mockResolvedValue({ matches: [], pendingMatches: [], next: null });
});

test('consumes the scoped page, shows the scope, and retains the query when opening context', async () => {
  const screen = render(<ChatSearchScreen />);
  expect(mockUseMessageSearch).toHaveBeenCalled();
  // The global-search handoff prefills both the field and the scoped request.
  expect(mockUseMessageSearch.mock.calls[0][1]).toBe('needle');
  expect(screen.getByDisplayValue('needle')).toBeTruthy();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Other: needle in context' })).toBeTruthy());
  expect(screen.getByText('Search · Group')).toBeTruthy();
  const result = screen.getByRole('button', { name: 'Other: needle in context' });
  fireEvent.press(result);
  fireEvent.press(result);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[chatId]', params: { chatId: 'chat', focusMessageId: 'message', searchQuery: 'needle' } });
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
});

test('goes back from scoped search', async () => {
  const screen = render(<ChatSearchScreen />);
  await waitFor(() => expect(screen.getByText('Search · Group')).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockRouter.back).toHaveBeenCalled();
});

test('keeps scoped results virtualized with bounded render batches', async () => {
  const screen = render(<ChatSearchScreen />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Other: needle in context' })).toBeTruthy());
  const list = screen.UNSAFE_getByType(FlatList);
  expect(list.props.initialNumToRender).toBe(8);
  expect(list.props.maxToRenderPerBatch).toBe(8);
  expect(list.props.windowSize).toBe(7);
  expect(list.props.removeClippedSubviews).toBeUndefined();
});

test('keeps already loaded pages across a first-page refresh and drops them for a new query', async () => {
  const firstPage: MessageMatch = { chatId: 'chat', messageId: 'message', createdAt: '2026-11-11T00:00:00Z', sender: 'Other', preview: 'needle in context', sources: ['content'] };
  const olderPage: MessageMatch = { chatId: 'chat', messageId: 'older', createdAt: '2026-11-09T00:00:00Z', sender: 'Other', preview: 'needle older', sources: ['content'] };
  const firstPageData: ScopedResultPage = { matches: [firstPage], pendingMatches: [], next: { createdAt: '2026-11-10T00:00:00Z', messageId: 'message' } };
  const response: MockSearchResult = {
    data: firstPageData,
    loading: false,
    error: null,
    epoch: 0,
    retry: jest.fn(),
  };
  mockUseMessageSearch.mockReturnValue(response);
  mockScopedPage.mockResolvedValue({ matches: [olderPage], pendingMatches: [], next: null });

  const screen = render(<ChatSearchScreen />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Other: needle in context' })).toBeTruthy());
  await act(async () => {
    screen.UNSAFE_getByType(FlatList).props.onEndReached?.({ distanceFromEnd: 0 });
  });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Other: needle older' })).toBeTruthy());

  // Returning focus refreshes the first page object for the same query and search epoch.
  mockUseMessageSearch.mockReturnValue({ ...response, data: { ...firstPageData, matches: [...firstPageData.matches] } });
  screen.rerender(<ChatSearchScreen />);
  expect(screen.getByRole('button', { name: 'Other: needle older' })).toBeTruthy();

  // A new query produces a different result identity, so retained pages must be dropped.
  fireEvent.changeText(screen.getByPlaceholderText(strings.search.placeholder), 'other');
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Other: needle older' })).toBeNull());
});
