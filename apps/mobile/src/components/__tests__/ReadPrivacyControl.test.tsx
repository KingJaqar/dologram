import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { getMyReadPrivacy, setMyReadPrivacy, strings } from '@dologram/shared';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ReadPrivacyControl } from '../ReadPrivacyControl';

jest.mock('../../lib/supabase', () => ({ supabase: {} }));
const mockShowToast = jest.fn();
const mockHideToast = jest.fn();
jest.mock('../Toast', () => ({ useToast: () => ({ showToast: mockShowToast, hideToast: mockHideToast }) }));
jest.mock('@dologram/shared', () => {
  const actual = jest.requireActual('@dologram/shared');
  return { ...actual, getMyReadPrivacy: jest.fn(), setMyReadPrivacy: jest.fn() };
});

const getPrivacy = jest.mocked(getMyReadPrivacy);
const setPrivacy = jest.mocked(setMyReadPrivacy);

beforeEach(() => jest.clearAllMocks());

test('loads the server value and retries the failed requested value without an optimistic lie', async () => {
  getPrivacy.mockResolvedValue({ data: 'everyone', error: null });
  setPrivacy
    .mockResolvedValueOnce({ data: null, error: { kind: 'network' } })
    .mockResolvedValueOnce({ data: 'nobody', error: null });
  const screen = render(<ThemeProvider><ReadPrivacyControl accountId="account-a" online /></ThemeProvider>);
  const toggle = await screen.findByRole('switch', { name: strings.readPrivacy.label });
  expect(toggle.props.accessibilityState.checked).toBe(true);
  fireEvent.press(toggle);
  expect(await screen.findByText(strings.readPrivacy.saveFailed)).toBeTruthy();
  expect(screen.getByRole('switch', { name: strings.readPrivacy.label }).props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByLabelText(strings.common.retry));
  await act(async () => undefined);
  expect(setPrivacy).toHaveBeenNthCalledWith(1, expect.anything(), 'nobody');
  expect(setPrivacy).toHaveBeenNthCalledWith(2, expect.anything(), 'nobody');
  expect(screen.getByRole('switch', { name: strings.readPrivacy.label }).props.accessibilityState.checked).toBe(false);
  expect(mockHideToast).toHaveBeenCalledWith(expect.stringContaining('read-privacy-save:'));
  expect(mockShowToast).toHaveBeenCalledWith({ message: strings.readPrivacy.saved, variant: 'success' });
});

test('does not query or save while offline', () => {
  const screen = render(<ThemeProvider><ReadPrivacyControl accountId="account-a" online={false} /></ThemeProvider>);
  const toggle = screen.getByRole('switch', { name: strings.readPrivacy.label });
  expect(toggle.props.accessibilityState.disabled).toBe(true);
  expect(screen.getByText(strings.common.noConnection)).toBeTruthy();
  expect(getPrivacy).not.toHaveBeenCalled();
  expect(setPrivacy).not.toHaveBeenCalled();
});

test('shows a retryable load failure without assuming a privacy value', async () => {
  getPrivacy.mockResolvedValue({ data: null, error: { kind: 'network' } });
  const screen = render(<ThemeProvider><ReadPrivacyControl accountId="account-a" online /></ThemeProvider>);
  expect(await screen.findByText(strings.readPrivacy.loadFailed)).toBeTruthy();
  expect(screen.queryByRole('switch', { name: strings.readPrivacy.label })).toBeNull();
});

test('reloads with a new account and ignores the old account response', async () => {
  let resolveOld!: (value: Awaited<ReturnType<typeof getMyReadPrivacy>>) => void;
  getPrivacy
    .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ data: 'nobody', error: null });
  const screen = render(<ThemeProvider><ReadPrivacyControl accountId="account-a" online /></ThemeProvider>);
  await waitFor(() => expect(getPrivacy).toHaveBeenCalledTimes(1));
  screen.rerender(<ThemeProvider><ReadPrivacyControl accountId="account-b" online /></ThemeProvider>);
  expect((await screen.findByRole('switch', { name: strings.readPrivacy.label })).props.accessibilityState.checked).toBe(false);
  await act(async () => resolveOld({ data: 'everyone', error: null }));
  expect(screen.getByRole('switch', { name: strings.readPrivacy.label }).props.accessibilityState.checked).toBe(false);
});
