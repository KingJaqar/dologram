import React from 'react';
import { AppState, TextInput, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import MemoLayout from '../../../app/memo/[memoId]/_layout';
import { enrollMemoPin, isMemoProtected, verifyMemoPin } from '../protection';
import { withMemoStore } from '../vault';
import { setMemoScope } from '../lifecycle';

const account = '00000000-0000-4000-8000-000000000001';
const memo = '10000000-0000-4000-8000-000000000001';
jest.mock('expo-router/js-stack', () => ({ Stack: () => { const { Text } = jest.requireActual('react-native'); return <Text>Protected route content</Text>; } }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ memoId: memo }) }));
jest.mock('../MemoProvider', () => ({ useMemoAccess: () => { const { memoScope } = jest.requireActual<typeof import('../lifecycle')>('../lifecycle'); return { scope: memoScope(), error: null }; } }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'signedIn', session: { user: { id: account } } }) }));
jest.mock('../../theme/ThemeProvider', () => ({ useTheme: () => { const { color } = jest.requireActual('@dologram/shared'); return { colors: color.dark }; } }));
jest.mock('../protection', () => ({ enrollMemoPin: jest.fn(), isMemoUnlocked: jest.fn(() => false), isMemoProtected: jest.fn(), verifyMemoPin: jest.fn(), lockMemo: jest.fn(), requestMemoPinReset: jest.fn(), verifyMemoPinReset: jest.fn() }));
jest.mock('../vault', () => ({ withMemoStore: jest.fn(async () => false), subscribeMemos: jest.fn(() => () => {}) }));
jest.mock('../../components/TextField', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { TextInput: Input } = jest.requireActual<typeof import('react-native')>('react-native');
  return { TextField: ({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) => createElement(Input, { value, onChangeText }) };
});
jest.mock('../../components/Button', () => ({ Button: ({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) => { const { Pressable, Text } = jest.requireActual('react-native'); return <Pressable disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable>; } }));
beforeEach(() => { jest.clearAllMocks(); jest.mocked(withMemoStore).mockResolvedValue(false); setMemoScope(account); });
afterEach(() => { setMemoScope(null); jest.restoreAllMocks(); });

test('the route layout withholds every child until PIN verification and locks on background', async () => {
  jest.mocked(isMemoProtected).mockResolvedValue(true);
  jest.mocked(verifyMemoPin).mockResolvedValue();
  let listener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { listener = callback; return { remove }; });
  const screen = render(<MemoLayout />);
  await screen.findByText('This memo is protected');
  expect(screen.queryByText('Protected route content')).toBeNull();
  fireEvent.changeText(screen.UNSAFE_getByType(TextInput), '123456');
  await act(async () => { fireEvent.press(screen.getByText('Unlock memo')); });
  await screen.findByText('Protected route content');
  expect(verifyMemoPin).toHaveBeenCalledWith(account, memo, '123456');
  act(() => { listener?.('background'); });
  await waitFor(() => expect(screen.queryByText('Protected route content')).toBeNull());
  screen.unmount(); expect(remove).toHaveBeenCalled();
});

test('mounts the memo route immediately while access is being checked', () => {
  jest.mocked(isMemoProtected).mockReturnValue(new Promise<boolean>(() => {}));
  const screen = render(<MemoLayout />);
  expect(screen.getByText('Protected route content')).toBeTruthy();
  expect(screen.queryByText('Checking memo access…')).toBeNull();
  expect(screen.queryByLabelText('Six-digit PIN')).toBeNull();
  expect(screen.queryByText('Unlock memo')).toBeNull();
  screen.unmount();
});

test('protection errors fail closed and do not mount the child stack', async () => {
  jest.mocked(isMemoProtected).mockRejectedValue(new Error('Key storage unavailable'));
  const screen = render(<MemoLayout />);
  await screen.findByText('Key storage unavailable');
  expect(screen.queryByText('Protected route content')).toBeNull();
});

test('a newly synchronized protected memo requires its own device PIN enrollment', async () => {
  jest.mocked(isMemoProtected).mockResolvedValue(false);
  jest.mocked(withMemoStore).mockResolvedValue(true);
  jest.mocked(enrollMemoPin).mockResolvedValue();
  const screen = render(<MemoLayout />);
  await screen.findByText('Enroll a PIN on this device to open this protected memo');
  expect(screen.queryByText('Protected route content')).toBeNull();
  const fields = screen.UNSAFE_getAllByType(TextInput);
  fireEvent.changeText(fields[0], '123456'); fireEvent.changeText(fields[1], '123456');
  await act(async () => { fireEvent.press(screen.getByText('Enroll device PIN')); });
  await screen.findByText('Protected route content');
  expect(enrollMemoPin).toHaveBeenCalledWith(account, memo, '123456', '123456');
});
