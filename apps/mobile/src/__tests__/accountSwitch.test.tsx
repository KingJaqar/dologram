import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { strings } from '@dologram/shared';
import { useRouter } from 'expo-router';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useAuth } from '../auth/AuthProvider';
import { createAccountAuthClient, supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { AccountSwitcherPopover } from '../components/AccountSwitcherPopover';
import { loadSavedAccounts, saveCurrentAccount, saveSessionAccount, shouldSkipAccountSwitchConfirmation, skipAccountSwitchConfirmation, type SavedAccount } from '../auth/savedAccounts';
import { switchToSavedAccount } from '../auth/accountSession';
import ManageAccountsScreen from '../../app/manage-accounts';

jest.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), setSession: jest.fn(), signOut: jest.fn() } },
  createAccountAuthClient: jest.fn(),
}));
jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../components/Toast', () => ({ useToast: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../notifications/pushNotifications', () => ({
  withPushRegistrationPaused: jest.fn((_id: string, change: () => Promise<unknown>) => change()),
}));

const currentSession = { user: { id: 'current', email: 'current@example.com' }, access_token: 'current-access', refresh_token: 'current-fresh-token' } as Session;
const nextSession = { user: { id: 'other', email: 'other@example.com' }, access_token: 'other-access', refresh_token: 'other-rotated-token' } as Session;
const currentProfile = { user_id: 'current', display_name: 'Juan', username: 'juan123', avatar_url: null };
const otherAccount: SavedAccount = {
  userId: 'other', email: 'other@example.com', username: 'other123', displayName: 'Maria',
  avatarUrl: null, refreshToken: 'other-saved-token', lastUsedAt: '2026-11-11T00:00:00Z',
};
const refreshSession = jest.fn();
const router = { replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(), back: jest.fn() };
const showToast = jest.fn();
const metrics = { frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function Wrapper({ children }: { children: React.ReactNode }) {
  return <SafeAreaProvider initialMetrics={metrics}><ThemeProvider>{children}</ThemeProvider></SafeAreaProvider>;
}

beforeEach(async () => {
  await loadSavedAccounts();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ session: currentSession, profile: currentProfile });
  (useRouter as jest.Mock).mockReturnValue(router);
  (useToast as jest.Mock).mockReturnValue({ showToast });
  (createAccountAuthClient as jest.Mock).mockReturnValue({ auth: { refreshSession } });
  refreshSession.mockResolvedValue({ data: { session: nextSession }, error: null });
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: currentSession }, error: null });
  (supabase.auth.setSession as jest.Mock).mockResolvedValue({ data: { session: nextSession }, error: null });
  await saveCurrentAccount(otherAccount);
});

test('the signed-in account opens its chat list immediately', async () => {
  const screen = render(<ManageAccountsScreen />, { wrapper: Wrapper });
  fireEvent.press(screen.getByRole('button', { name: 'Switch to Juan' }));
  expect(router.replace).toHaveBeenCalledWith('/(main)/(tabs)');
  expect(refreshSession).not.toHaveBeenCalled();
  expect(screen.queryByText(strings.manageAccounts.switchConfirmTitle)).toBeNull();
  await screen.findByRole('button', { name: 'Switch to Maria' });
});

test('canceling confirmation preserves the active session and the saved account', async () => {
  const screen = render(<ManageAccountsScreen />, { wrapper: Wrapper });
  fireEvent.press(await screen.findByRole('button', { name: 'Switch to Maria' }));
  expect(await screen.findByText(strings.manageAccounts.switchConfirmTitle)).toBeTruthy();
  fireEvent.press(screen.getAllByRole('button', { name: 'Cancel' })[1]);
  expect(refreshSession).not.toHaveBeenCalled();
  expect(supabase.auth.setSession).not.toHaveBeenCalled();
  expect((await loadSavedAccounts()).map((account) => account.userId)).toEqual(['other']);
});

test('the popover current account closes the switcher and opens chats', async () => {
  const onClose = jest.fn();
  const screen = render(<AccountSwitcherPopover visible onClose={onClose} />, { wrapper: Wrapper });
  fireEvent.press(screen.getByRole('button', { name: 'Switch to Juan' }));
  expect(onClose).toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/(main)/(tabs)');
  expect(refreshSession).not.toHaveBeenCalled();
  await screen.findByRole('button', { name: 'Switch to Maria' });
});

test('a saved account can be restored while signed out', async () => {
  (useAuth as jest.Mock).mockReturnValue({ session: null, profile: null });
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
  await skipAccountSwitchConfirmation();
  const screen = render(<ManageAccountsScreen />, { wrapper: Wrapper });
  fireEvent.press(await screen.findByRole('button', { name: 'Switch to Maria' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(main)/(tabs)'));
  expect(supabase.auth.setSession).toHaveBeenCalledWith(nextSession);
});

test('confirming switches accounts and remembers the checkbox across both switchers', async () => {
  const screen = render(<ManageAccountsScreen />, { wrapper: Wrapper });
  fireEvent.press(await screen.findByRole('button', { name: 'Switch to Maria' }));
  fireEvent.press(await screen.findByRole('checkbox', { name: strings.manageAccounts.dontAskAgain }));
  fireEvent.press(screen.getByRole('button', { name: strings.manageAccounts.switchConfirm }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(main)/(tabs)'));
  expect(await shouldSkipAccountSwitchConfirmation()).toBe(true);
  expect(refreshSession).toHaveBeenCalledWith({ refresh_token: 'other-saved-token' });
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
  const accounts = await loadSavedAccounts();
  expect(accounts.find((account) => account.userId === 'current')?.refreshToken).toBe(currentSession.refresh_token);
  expect(accounts.find((account) => account.userId === 'other')?.refreshToken).toBe(nextSession.refresh_token);
  screen.unmount();

  const popover = render(<AccountSwitcherPopover visible onClose={jest.fn()} />, { wrapper: Wrapper });
  fireEvent.press(await popover.findByRole('button', { name: 'Switch to Maria' }));
  await waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(2));
  expect(popover.queryByText(strings.manageAccounts.switchConfirmTitle)).toBeNull();
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(2));
});

test('a network failure preserves the account and leaves the current session active', async () => {
  await skipAccountSwitchConfirmation();
  refreshSession.mockResolvedValue({ data: { session: null }, error: { status: 0 } });
  const screen = render(<ManageAccountsScreen />, { wrapper: Wrapper });
  fireEvent.press(await screen.findByRole('button', { name: 'Switch to Maria' }));
  await waitFor(() => expect(showToast).toHaveBeenCalledWith({ message: strings.toasts.actions.switchAccount.error, variant: 'error', placement: 'bottom', surviveAccountChange: true }));
  expect(screen.getByRole('button', { name: 'Switch to Maria' })).toBeTruthy();
  expect((await loadSavedAccounts()).some((account) => account.userId === 'other')).toBe(true);
  expect(supabase.auth.setSession).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

test('an expired legacy token prompts sign-in while preserving the saved account', async () => {
  await skipAccountSwitchConfirmation();
  refreshSession.mockResolvedValue({ data: { session: null }, error: { code: 'refresh_token_not_found', status: 400 } });
  const screen = render(<ManageAccountsScreen />, { wrapper: Wrapper });
  fireEvent.press(await screen.findByRole('button', { name: 'Switch to Maria' }));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith({ pathname: '/sign-in', params: { addAccount: '1', identifier: 'other@example.com' } }));
  expect((await loadSavedAccounts()).some((account) => account.userId === 'other')).toBe(true);
  expect(supabase.auth.setSession).not.toHaveBeenCalled();
});

test('the popover add-account action opens manage accounts', async () => {
  const screen = render(<AccountSwitcherPopover visible onClose={jest.fn()} />, { wrapper: Wrapper });
  fireEvent.press(await screen.findByRole('button', { name: strings.manageAccounts.loginAnother }));
  expect(router.push).toHaveBeenCalledWith('/manage-accounts');
});

test('adding another account opens sign-in without revoking the current session', async () => {
  const screen = render(<ManageAccountsScreen />, { wrapper: Wrapper });
  fireEvent.press(screen.getByRole('button', { name: strings.manageAccounts.loginAnother }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/sign-in', params: { addAccount: '1' } });
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
  await screen.findByRole('button', { name: 'Switch to Maria' });
});

test('a refreshed token survives a subsequent activation failure', async () => {
  (supabase.auth.setSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: new Error('Activation failed') });
  await expect(switchToSavedAccount('other', 'current', currentProfile)).rejects.toThrow('Activation failed');
  expect((await loadSavedAccounts()).find((account) => account.userId === 'other')?.refreshToken).toBe(nextSession.refresh_token);
});

test('concurrent session saves preserve both accounts and existing profile details', async () => {
  await Promise.all([saveSessionAccount(currentSession, currentProfile), saveSessionAccount(nextSession, null)]);
  const accounts = await loadSavedAccounts();
  expect(accounts).toHaveLength(2);
  expect(accounts.find((account) => account.userId === 'other')).toMatchObject({ displayName: 'Maria', refreshToken: nextSession.refresh_token });
  expect(accounts.find((account) => account.userId === 'current')).toMatchObject({ displayName: 'Juan', refreshToken: currentSession.refresh_token });
});
