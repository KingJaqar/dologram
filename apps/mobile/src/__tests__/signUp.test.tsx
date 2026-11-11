/**
 * AND-01b Create account render tests (Phase 4 Step 11, D-163).
 * - A 4-character username, mismatched passwords and an 11-character password are refused
 *   with field errors and nothing is sent.
 * - An invalid email shows its field error.
 * - A duplicate email and a taken username show the two D-163 messages.
 * - Offline: the button is disabled with "No connection".
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { strings } from '@dologram/shared';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useNetState } from '../net/netState';
import { supabase } from '../lib/supabase';
import SignUpScreen from '../../app/sign-up';

const mockToast = jest.fn();
jest.mock('../components/Toast', () => ({ useToast: () => ({ showToast: mockToast }) }));

jest.mock('../lib/supabase', () => ({
  supabase: { auth: { signUp: jest.fn() }, rpc: jest.fn() },
}));

jest.mock('../net/netState', () => ({
  useNetState: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(() => ({ session: null, profile: null })),
}));

jest.mock('../auth/accountSession', () => ({
  ADD_ACCOUNT_PARAMS: { addAccount: '1' },
  activateAccountSession: jest.fn(),
}));

const mockSignUp = supabase.auth.signUp as jest.Mock;
const mockUseNetState = useNetState as jest.Mock;

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

type Screen = ReturnType<typeof render>;

function createButton(screen: Screen) {
  return screen.getByRole('button', { name: strings.signUp.submit });
}

function fillValidForm(screen: Screen) {
  fireEvent.changeText(screen.getByLabelText(strings.signUp.email), 'new@example.com');
  fireEvent.changeText(screen.getByLabelText(strings.signUp.password), 'abcdefghijkl');
  fireEvent.changeText(screen.getByLabelText(strings.signUp.confirmPassword), 'abcdefghijkl');
  fireEvent.changeText(screen.getByLabelText(strings.signUp.username), 'new_user');
  fireEvent.changeText(screen.getByLabelText(strings.signUp.displayName), 'New User');
}

describe('AND-01b Create account', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockSignUp.mockReset();
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });
    mockUseNetState.mockReturnValue({
      isConnected: true,
      type: 'wifi',
      cellularGeneration: null,
    });
  });

  test('refuses a 4-character username', async () => {
    const screen = render(<SignUpScreen />, { wrapper: Wrapper });

    fillValidForm(screen);
    fireEvent.changeText(screen.getByLabelText(strings.signUp.username), 'abcd');
    fireEvent.press(createButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.signUp.usernameInvalid)).toBeTruthy();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  test('refuses mismatched passwords', async () => {
    const screen = render(<SignUpScreen />, { wrapper: Wrapper });

    fillValidForm(screen);
    fireEvent.changeText(
      screen.getByLabelText(strings.signUp.confirmPassword),
      'abcdefghijkm',
    );
    fireEvent.press(createButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.changePassword.mismatch)).toBeTruthy();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  test('refuses an 11-character password', async () => {
    const screen = render(<SignUpScreen />, { wrapper: Wrapper });

    fillValidForm(screen);
    fireEvent.changeText(screen.getByLabelText(strings.signUp.password), 'abcdefghijk');
    fireEvent.changeText(screen.getByLabelText(strings.signUp.confirmPassword), 'abcdefghijk');
    fireEvent.press(createButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.changePassword.tooShort)).toBeTruthy();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  test('an invalid email shows its field error', async () => {
    const screen = render(<SignUpScreen />, { wrapper: Wrapper });

    fillValidForm(screen);
    fireEvent.changeText(screen.getByLabelText(strings.signUp.email), 'not-an-email');
    fireEvent.press(createButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.signIn.invalidEmail)).toBeTruthy();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  test('a duplicate email shows the taken message', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null },
      error: {
        status: 422,
        code: 'user_already_exists',
        message: 'User already registered',
      },
    });

    const screen = render(<SignUpScreen />, { wrapper: Wrapper });
    fillValidForm(screen);
    await screen.findByText(strings.signUp.usernameAvailable);
    fireEvent.press(createButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.signUp.emailTaken)).toBeTruthy();
      expect(mockToast).toHaveBeenCalledWith({ message: strings.signUp.emailTaken, variant: 'error', placement: 'bottom', surviveAccountChange: true });
    });
  });

  test('a taken username shows the username message', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null },
      error: {
        status: 500,
        code: 'unexpected_failure',
        message: 'duplicate key value violates unique constraint "profiles_username_key"',
      },
    });

    const screen = render(<SignUpScreen />, { wrapper: Wrapper });
    fillValidForm(screen);
    await screen.findByText(strings.signUp.usernameAvailable);
    fireEvent.press(createButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.signUp.usernameTaken)).toBeTruthy();
    });
  });

  test('confirmed account creation emits one success', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'new' }, session: null }, error: null });
    const screen = render(<SignUpScreen />, { wrapper: Wrapper });
    fillValidForm(screen);
    await screen.findByText(strings.signUp.usernameAvailable);
    fireEvent.press(createButton(screen));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ message: strings.toasts.actions.createAccount.success, variant: 'success', placement: 'bottom', surviveAccountChange: true }));
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  test('offline: Create account is disabled with "No connection"', () => {
    mockUseNetState.mockReturnValue({
      isConnected: false,
      type: 'none',
      cellularGeneration: null,
    });

    const screen = render(<SignUpScreen />, { wrapper: Wrapper });

    expect(createButton(screen).props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText(strings.common.noConnection)).toBeTruthy();
  });
});
