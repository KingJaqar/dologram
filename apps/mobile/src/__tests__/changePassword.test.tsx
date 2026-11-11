/**
 * AND-02 Change password render tests (Phase 4 Step 8, D-47, D-78).
 * - A new password of 11 characters is refused on the client.
 * - Mismatched fields are refused on the client.
 * - While forced there is no back button; from Settings there is one.
 * - Offline: Save is disabled with "No connection".
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { strings } from '@dologram/shared';
import { useRouter } from 'expo-router';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useAuth } from '../auth/AuthProvider';
import { useNetState } from '../net/netState';
import { supabase } from '../lib/supabase';
import ChangePasswordScreen from '../../app/change-password';

jest.mock('../lib/supabase', () => ({
  supabase: { auth: { updateUser: jest.fn(), refreshSession: jest.fn() } },
}));

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../net/netState', () => ({
  useNetState: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockUpdateUser = supabase.auth.updateUser as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseNetState = useNetState as jest.Mock;
const mockRouter = {
  canGoBack: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
};

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

function saveButton(screen: ReturnType<typeof render>) {
  return screen.getByRole('button', { name: strings.changePassword.save });
}

describe('AND-02 Change password', () => {
  beforeEach(() => {
    mockRouter.canGoBack.mockReset().mockReturnValue(true);
    mockRouter.back.mockReset();
    mockRouter.replace.mockReset();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    mockUpdateUser.mockReset();
    mockUseAuth.mockReturnValue({ status: 'mustChangePassword', session: null, profile: null });
    mockUseNetState.mockReturnValue({
      isConnected: true,
      type: 'wifi',
      cellularGeneration: null,
    });
  });

  test('refuses a new password of 11 characters', async () => {
    const screen = render(<ChangePasswordScreen />, { wrapper: Wrapper });

    fireEvent.changeText(
      screen.getByLabelText(strings.changePassword.newPassword),
      'abcdefghijk',
    );
    fireEvent.changeText(
      screen.getByLabelText(strings.changePassword.confirmPassword),
      'abcdefghijk',
    );
    fireEvent.press(saveButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.changePassword.tooShort)).toBeTruthy();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test("refuses fields that don't match", async () => {
    const screen = render(<ChangePasswordScreen />, { wrapper: Wrapper });

    fireEvent.changeText(
      screen.getByLabelText(strings.changePassword.newPassword),
      'abcdefghijkl',
    );
    fireEvent.changeText(
      screen.getByLabelText(strings.changePassword.confirmPassword),
      'abcdefghijkm',
    );
    fireEvent.press(saveButton(screen));

    await waitFor(() => {
      expect(screen.getByText(strings.changePassword.mismatch)).toBeTruthy();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test('while forced there is no back button', () => {
    const screen = render(<ChangePasswordScreen />, { wrapper: Wrapper });

    expect(screen.queryByLabelText('Go back')).toBeNull();
  });

  test('opened from Settings it has a back button', () => {
    mockUseAuth.mockReturnValue({ status: 'signedIn', session: null, profile: null });

    const screen = render(<ChangePasswordScreen />, { wrapper: Wrapper });

    expect(screen.getByLabelText('Go back')).toBeTruthy();
  });

  test.each([true, false])('back button handles available history: %s', (canGoBack) => {
    mockUseAuth.mockReturnValue({ status: 'signedIn', session: null, profile: null });
    mockRouter.canGoBack.mockReturnValue(canGoBack);
    const screen = render(<ChangePasswordScreen />, { wrapper: Wrapper });

    fireEvent.press(screen.getByLabelText('Go back'));

    if (canGoBack) {
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      expect(mockRouter.replace).not.toHaveBeenCalled();
    } else {
      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/(main)/(tabs)/settings');
    }
  });

  test.each(['mustChangePassword', 'signedIn'])('successful save without history: %s', async (status) => {
    mockUseAuth.mockReturnValue({ status, session: null, profile: null });
    mockRouter.canGoBack.mockReturnValue(false);
    mockUpdateUser.mockResolvedValue({ error: null });
    const screen = render(<ChangePasswordScreen />, { wrapper: Wrapper });

    fireEvent.changeText(screen.getByLabelText(strings.changePassword.newPassword), 'abcdefghijkl');
    fireEvent.changeText(screen.getByLabelText(strings.changePassword.confirmPassword), 'abcdefghijkl');
    fireEvent.press(saveButton(screen));

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        status === 'mustChangePassword' ? '/(main)/(tabs)' : '/(main)/(tabs)/settings',
      );
    });
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  test('offline: Save is disabled with "No connection"', () => {
    mockUseNetState.mockReturnValue({
      isConnected: false,
      type: 'none',
      cellularGeneration: null,
    });

    const screen = render(<ChangePasswordScreen />, { wrapper: Wrapper });

    expect(saveButton(screen).props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText(strings.common.noConnection)).toBeTruthy();
  });
});
