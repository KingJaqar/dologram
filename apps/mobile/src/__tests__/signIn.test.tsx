/**
 * AND-01 Sign-in render tests (Phase 4 Step 8, T-10 UI part).
 * - Offline: Sign in is disabled and "No connection" is shown (F1 Offline).
 * - Invalid email: the field error appears and nothing is sent (D-116).
 * - Blank password: refused before sending (plan step 4).
 * - A 400 from Auth shows the single wrong-credentials message (AND-01).
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { strings } from '@dologram/shared';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useNetState } from '../net/netState';
import { supabase } from '../lib/supabase';
import { loadSavedAccounts } from '../auth/savedAccounts';
import { activateAccountSession } from '../auth/accountSession';
import SignInScreen from '../../app/sign-in';

const mockToast = jest.fn();
jest.mock('../components/Toast', () => ({ useToast: () => ({ showToast: mockToast }) }));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signInWithPassword: jest.fn(), setSession: jest.fn() },
    functions: { invoke: jest.fn() },
  },
  createAccountAuthClient: jest.fn(),
}));

jest.mock('../net/netState', () => ({
  useNetState: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(() => ({ session: null, profile: null })),
}));

jest.mock('../auth/accountSession', () => ({
  ADD_ACCOUNT_PARAMS: { addAccount: '1' },
  activateAccountSession: jest.fn(),
}));

jest.mock('../auth/savedAccounts', () => ({
  loadSavedAccounts: jest.fn(),
}));

const mockSignInWithPassword = supabase.auth.signInWithPassword as jest.Mock;
const mockSetSession = supabase.auth.setSession as jest.Mock;
const mockInvoke = supabase.functions.invoke as jest.Mock;
const mockUseNetState = useNetState as jest.Mock;
const mockUseRouter = (jest.requireMock('expo-router') as { useRouter: jest.Mock }).useRouter;
const mockLoadSavedAccounts = loadSavedAccounts as jest.Mock;
const mockParams = (jest.requireMock('expo-router') as { useLocalSearchParams: jest.Mock }).useLocalSearchParams;
const mockUseAuth = (jest.requireMock('../auth/AuthProvider') as { useAuth: jest.Mock }).useAuth;
const mockCreateAccountAuthClient = (jest.requireMock('../lib/supabase') as { createAccountAuthClient: jest.Mock }).createAccountAuthClient;
const mockActivate = activateAccountSession as jest.Mock;
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };

const initialMetrics = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider>{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

function signInButton(screen: ReturnType<typeof render>) {
  return screen.getByRole('button', { name: strings.signIn.title });
}

describe('AND-01 Sign in', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockParams.mockReturnValue({});
    mockUseAuth.mockReturnValue({ session: null, profile: null });
    mockActivate.mockReset();
    mockSignInWithPassword.mockReset();
    mockSetSession.mockReset();
    mockInvoke.mockReset();
    mockUseRouter.mockReset();
    mockUseRouter.mockReturnValue(mockRouter);
    mockPush.mockReset();
    mockReplace.mockReset();
    mockLoadSavedAccounts.mockReset();
    mockLoadSavedAccounts.mockResolvedValue([]);
    mockSignInWithPassword.mockResolvedValue({ data: null, error: null });
    mockUseNetState.mockReturnValue({
      isConnected: true,
      type: 'wifi',
      cellularGeneration: null,
    });
  });

  test('offline: Sign in is disabled and "No connection" is shown', () => {
    mockUseNetState.mockReturnValue({
      isConnected: false,
      type: 'none',
      cellularGeneration: null,
    });

    const screen = render(<SignInScreen />, { wrapper: Wrapper });

    expect(signInButton(screen).props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText(strings.common.noConnection)).toBeTruthy();
  });

  test('an invalid email shows the field error and sends nothing', async () => {
    const screen = render(<SignInScreen />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByLabelText(strings.signIn.emailOrUsername), 'not-an-email');
    fireEvent.changeText(screen.getByLabelText(strings.signIn.password), 'a-password');
    fireEvent.press(signInButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.signIn.invalidIdentifier)).toBeTruthy();
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  test('a blank password is refused before sending', async () => {
    const screen = render(<SignInScreen />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByLabelText(strings.signIn.emailOrUsername), 'user@example.com');
    fireEvent.press(signInButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.signIn.passwordRequired)).toBeTruthy();
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  test('a 400 from Auth shows the single wrong-credentials message', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: null, error: { status: 400 } });

    const screen = render(<SignInScreen />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByLabelText(strings.signIn.emailOrUsername), 'user@example.com');
    fireEvent.changeText(screen.getByLabelText(strings.signIn.password), 'a-password');
    fireEvent.press(signInButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.signIn.wrongCredentials)).toBeTruthy();
      expect(mockToast).toHaveBeenCalledWith({ message: strings.signIn.wrongCredentials, variant: 'error', placement: 'bottom', surviveAccountChange: true });
    });
  });

  test('a valid username resolves to its email before signing in', async () => {
    mockInvoke.mockResolvedValue({
      data: { session: { access_token: 'access-token', refresh_token: 'refresh-token' } },
      error: null,
    });
    mockSetSession.mockResolvedValue({ data: { session: null, user: null }, error: null });

    const screen = render(<SignInScreen />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByLabelText(strings.signIn.emailOrUsername), 'alexx');
    fireEvent.changeText(screen.getByLabelText(strings.signIn.password), 'a-password');
    fireEvent.press(signInButton(screen));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('sign-in-username', {
        body: { username: 'alexx', password: 'a-password' },
      });
      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      });
    });
  });

  test('an invalid username or password does not create a session', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { context: { status: 401 } },
    });

    const screen = render(<SignInScreen />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByLabelText(strings.signIn.emailOrUsername), 'missing_user');
    fireEvent.changeText(screen.getByLabelText(strings.signIn.password), 'a-password');
    fireEvent.press(signInButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.signIn.wrongCredentialsUsername)).toBeTruthy();
    });
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  test('a 429 from Auth shows the rate-limit message', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: null, error: { status: 429 } });

    const screen = render(<SignInScreen />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByLabelText(strings.signIn.emailOrUsername), 'user@example.com');
    fireEvent.changeText(screen.getByLabelText(strings.signIn.password), 'a-password');
    fireEvent.press(signInButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.signIn.tooManyAttempts)).toBeTruthy();
    });
  });

  test('Manage Accounts is visible and opens locally when an account is saved', async () => {
    mockLoadSavedAccounts.mockResolvedValue([{ userId: 'account-1' }]);

    const screen = render(<SignInScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: strings.signIn.manageAccounts })).toBeTruthy();
    });
    fireEvent.press(screen.getByRole('button', { name: strings.signIn.manageAccounts }));

    expect(mockReplace).toHaveBeenCalledWith('/manage-accounts');
  });

  test('Manage Accounts is hidden when no account is saved', async () => {
    const screen = render(<SignInScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockLoadSavedAccounts).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: strings.signIn.manageAccounts })).toBeNull();
  });

  test('adding an account authenticates separately before activating its session', async () => {
    mockParams.mockReturnValue({ addAccount: '1' });
    mockUseAuth.mockReturnValue({ session: { user: { id: 'current' } }, profile: null });
    const nextSession = { user: { id: 'other' }, access_token: 'access', refresh_token: 'refresh' };
    const signIn = jest.fn().mockResolvedValue({ data: { session: nextSession }, error: null });
    mockCreateAccountAuthClient.mockReturnValue({ auth: { signInWithPassword: signIn } });
    const screen = render(<SignInScreen />, { wrapper: Wrapper });
    fireEvent.changeText(screen.getByLabelText(strings.signIn.emailOrUsername), 'other@example.com');
    fireEvent.changeText(screen.getByLabelText(strings.signIn.password), 'a-password');
    fireEvent.press(signInButton(screen));
    await waitFor(() => expect(mockActivate).toHaveBeenCalledWith(nextSession, 'current', null));
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(main)/(tabs)');
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith({ message: strings.toasts.actions.login.success, variant: 'success', placement: 'bottom', surviveAccountChange: true });
  });

  test('a failed added-account sign-in leaves the current session active', async () => {
    mockParams.mockReturnValue({ addAccount: '1', identifier: 'other@example.com' });
    mockUseAuth.mockReturnValue({ session: { user: { id: 'current' } }, profile: null });
    const signIn = jest.fn().mockResolvedValue({ data: null, error: { status: 400 } });
    mockCreateAccountAuthClient.mockReturnValue({ auth: { signInWithPassword: signIn } });
    const screen = render(<SignInScreen />, { wrapper: Wrapper });
    fireEvent.changeText(screen.getByLabelText(strings.signIn.password), 'a-password');
    fireEvent.press(signInButton(screen));
    expect(await screen.findByText(strings.signIn.wrongCredentials)).toBeTruthy();
    expect(mockActivate).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
