import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import LocalMemos from '../../../app/local-memos';
import { authorizeOfflineMemo, enrolledMemoAccounts } from '../vault';
import { memoScope, setMemoScope } from '../lifecycle';
import { strings } from '@dologram/shared';

const account = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('../vault', () => ({ authorizeOfflineMemo: jest.fn(), enrolledMemoAccounts: jest.fn() }));
jest.mock('../useMemos', () => ({ useMemos: () => ({ memos: [], links: [], error: null, loading: false, reload: jest.fn() }) }));
jest.mock('../NewConversationMenu', () => ({ NewConversationMenu: () => null }));
jest.mock('../MemoOrganizationActions', () => ({ MemoOrganizationActions: () => null }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'signedOut', session: null }) }));
jest.mock('../../queue/db', () => ({ getLocalDatabase: async () => ({}) }));
jest.mock('../../folders/cache', () => ({ loadCachedFolders: async () => [] }));
jest.mock('../../components/ChatRow', () => ({ ChatRow: () => null }));
jest.mock('../../components/Icon', () => ({ Icon: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('../../theme/ThemeProvider', () => ({ useTheme: () => {
  const { color, typeTokens, radius, space } = jest.requireActual('@dologram/shared'); return { colors: color.light, typeTokens, radius, space };
} }));
beforeEach(() => {
  setMemoScope(null); jest.clearAllMocks();
  jest.mocked(enrolledMemoAccounts).mockResolvedValue([account]);
  jest.mocked(authorizeOfflineMemo).mockResolvedValue(undefined);
});
afterEach(() => { setMemoScope(null); });
test('signed-out account selection verifies the enrolled gate and opens only the local library', async () => {
  const screen = render(<LocalMemos />);
  fireEvent.press(await screen.findByRole('button', { name: 'Account 00000001' }));
  await waitFor(() => expect(memoScope()).toMatchObject({ accountId: account, offline: true }));
  expect(authorizeOfflineMemo).toHaveBeenCalledWith(account);
  expect(screen.queryByText(strings.memos.empty)).toBeTruthy();
  expect(mockRouter.push).not.toHaveBeenCalled();
});
test('failed key access keeps account selection closed and reports recovery feedback', async () => {
  jest.mocked(authorizeOfflineMemo).mockRejectedValue(new Error('Key unavailable'));
  const screen = render(<LocalMemos />);
  fireEvent.press(await screen.findByRole('button', { name: 'Account 00000001' }));
  await screen.findByText('Key unavailable'); expect(memoScope()).toBeNull();
});
test('a delayed offline authorization cannot replace a newer account', async () => {
  let finish: () => void = () => {};
  jest.mocked(authorizeOfflineMemo).mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  const screen = render(<LocalMemos />);
  fireEvent.press(await screen.findByRole('button', { name: 'Account 00000001' }));
  await act(async () => { setMemoScope(other); finish(); });
  expect(memoScope()).toMatchObject({ accountId: other, offline: false });
});
