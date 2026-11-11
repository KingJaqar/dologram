/**
 * Reset password render tests (Phase 4 Step 11, D-181).
 * - The recovery code is exchanged on open; the form appears once it succeeds.
 * - An 11-character password and mismatched fields are refused with field errors.
 * - A missing or rejected code shows the expired-link message with a way to request a new one.
 * - Offline: Save is disabled with "No connection".
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { strings } from '@dologram/shared';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useNetState } from '../net/netState';
import { supabase } from '../lib/supabase';
import ResetPasswordScreen from '../../app/reset-password';

jest.mock('../lib/supabase', () => ({
  supabase: { auth: { exchangeCodeForSession: jest.fn(), updateUser: jest.fn() } },
}));

jest.mock('../net/netState', () => ({
  useNetState: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
}));

const { useLocalSearchParams } = jest.requireMock('expo-router') as {
  useLocalSearchParams: jest.Mock;
};
const mockExchangeCode = supabase.auth.exchangeCodeForSession as jest.Mock;
const mockUpdateUser = supabase.auth.updateUser as jest.Mock;
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

async function renderReadyScreen() {
  mockExchangeCode.mockResolvedValue({ data: {}, error: null });
  const screen = render(<ResetPasswordScreen />, { wrapper: Wrapper });
  await waitFor(() => {
    expect(screen.getByLabelText(strings.resetPassword.newPassword)).toBeTruthy();
  });
  return screen;
}

describe('Reset password', () => {
  beforeEach(() => {
    mockExchangeCode.mockReset();
    mockUpdateUser.mockReset();
    useLocalSearchParams.mockReturnValue({ code: 'recovery-code' });
    mockUseNetState.mockReturnValue({
      isConnected: true,
      type: 'wifi',
      cellularGeneration: null,
    });
  });

  test('refuses an 11-character password', async () => {
    const screen = await renderReadyScreen();

    fireEvent.changeText(screen.getByLabelText(strings.resetPassword.newPassword), 'abcdefghijk');
    fireEvent.changeText(screen.getByLabelText(strings.resetPassword.confirm), 'abcdefghijk');
    fireEvent.press(screen.getByRole('button', { name: strings.resetPassword.save }));

    await waitFor(() => {
      expect(screen.getByText(strings.changePassword.tooShort)).toBeTruthy();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test("refuses fields that don't match", async () => {
    const screen = await renderReadyScreen();

    fireEvent.changeText(screen.getByLabelText(strings.resetPassword.newPassword), 'abcdefghijkl');
    fireEvent.changeText(screen.getByLabelText(strings.resetPassword.confirm), 'abcdefghijkm');
    fireEvent.press(screen.getByRole('button', { name: strings.resetPassword.save }));

    await waitFor(() => {
      expect(screen.getByText(strings.changePassword.mismatch)).toBeTruthy();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test('a rejected code shows the expired-link message', async () => {
    mockExchangeCode.mockResolvedValue({
      data: {},
      error: { status: 400, code: 'invalid_code', message: 'invalid flow state' },
    });

    const screen = render(<ResetPasswordScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(strings.resetPassword.expiredLink)).toBeTruthy();
    });
    expect(
      screen.getByRole('button', { name: strings.resetPassword.requestNew }),
    ).toBeTruthy();
  });

  test('a missing code shows the expired-link message', () => {
    useLocalSearchParams.mockReturnValue({});

    const screen = render(<ResetPasswordScreen />, { wrapper: Wrapper });

    expect(screen.getByText(strings.resetPassword.expiredLink)).toBeTruthy();
    expect(mockExchangeCode).not.toHaveBeenCalled();
  });

  test('offline: Save is disabled with "No connection"', async () => {
    mockUseNetState.mockReturnValue({
      isConnected: false,
      type: 'none',
      cellularGeneration: null,
    });

    const screen = await renderReadyScreen();

    const button = screen.getByRole('button', { name: strings.resetPassword.save });
    expect(button.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText(strings.common.noConnection)).toBeTruthy();
  });
});
