/**
 * Forgot password render tests (Phase 4 Step 11, D-181).
 * - A successful (mocked) send shows the "Check your email..." confirmation.
 * - An invalid email is refused before sending.
 * - Offline: the button is disabled with "No connection".
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { strings } from '@dologram/shared';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useNetState } from '../net/netState';
import { supabase } from '../lib/supabase';
import ForgotPasswordScreen from '../../app/forgot-password';

jest.mock('../lib/supabase', () => ({
  supabase: { auth: { resetPasswordForEmail: jest.fn() } },
}));

jest.mock('../net/netState', () => ({
  useNetState: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('../auth/accountSession', () => ({
  ADD_ACCOUNT_PARAMS: { addAccount: '1' },
}));

const mockResetPasswordForEmail = supabase.auth.resetPasswordForEmail as jest.Mock;
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

describe('Forgot password', () => {
  beforeEach(() => {
    mockResetPasswordForEmail.mockReset();
    mockUseNetState.mockReturnValue({
      isConnected: true,
      type: 'wifi',
      cellularGeneration: null,
    });
  });

  test('shows the confirmation after a successful send', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const screen = render(<ForgotPasswordScreen />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByLabelText(strings.forgotPassword.email), 'user@example.com');
    fireEvent.press(screen.getByRole('button', { name: strings.forgotPassword.submit }));

    await waitFor(() => {
      expect(screen.getByText(strings.forgotPassword.sent)).toBeTruthy();
    });
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'dologram://reset-password',
    });
  });

  test('an invalid email is refused before sending', async () => {
    const screen = render(<ForgotPasswordScreen />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByLabelText(strings.forgotPassword.email), 'not-an-email');
    fireEvent.press(screen.getByRole('button', { name: strings.forgotPassword.submit }));

    await waitFor(() => {
      expect(screen.getByText(strings.signIn.invalidEmail)).toBeTruthy();
    });
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  test('offline: Send reset link is disabled with "No connection"', () => {
    mockUseNetState.mockReturnValue({
      isConnected: false,
      type: 'none',
      cellularGeneration: null,
    });

    const screen = render(<ForgotPasswordScreen />, { wrapper: Wrapper });

    const button = screen.getByRole('button', { name: strings.forgotPassword.submit });
    expect(button.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText(strings.common.noConnection)).toBeTruthy();
  });
});
