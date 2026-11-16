import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { strings } from '@dologram/shared';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useAuth } from '../auth/AuthProvider';
import ProfileScreen from '../../app/profile';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../net/netState', () => ({ useNetState: () => ({ isConnected: true }) }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../components/Toast', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({}) }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));

const profile = { user_id: 'juan', display_name: 'Juan', username: 'juan123', avatar_url: null };
const refreshProfile = jest.fn();
const updateProfile = jest.fn();
const metrics = { frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function Wrapper({ children }: { children: React.ReactNode }) {
  return <SafeAreaProvider initialMetrics={metrics}><ThemeProvider>{children}</ThemeProvider></SafeAreaProvider>;
}

function auth(value: typeof profile | null) {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn', session: null, profile: value, refreshProfile, updateProfile,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  auth(null);
});

test('a profile arriving during the request populates and unlocks the form', async () => {
  refreshProfile.mockReturnValue(new Promise(() => {}));
  const screen = render(<ProfileScreen />, { wrapper: Wrapper });
  auth(profile);
  screen.rerender(<ProfileScreen />);
  await waitFor(() => expect(screen.getByLabelText(strings.signUp.displayName).props.value).toBe('Juan'));
  expect(screen.getByLabelText(strings.signUp.username).props.value).toBe('juan123');
  expect(screen.getByLabelText(strings.signUp.displayName).props.editable).toBe(true);
  fireEvent.changeText(screen.getByLabelText(strings.signUp.displayName), 'Edited name');
  screen.rerender(<ProfileScreen />);
  expect(screen.getByLabelText(strings.signUp.displayName).props.value).toBe('Edited name');
});

test.each(['rejected', 'missing'])('a %s profile can be retried without allowing empty saves', async (failure) => {
  if (failure === 'rejected') refreshProfile.mockRejectedValueOnce(new Error('permission denied'));
  else refreshProfile.mockResolvedValueOnce(null);
  refreshProfile.mockResolvedValueOnce(profile);
  const screen = render(<ProfileScreen />, { wrapper: Wrapper });
  fireEvent.press(await screen.findByRole('button', { name: strings.common.couldNotLoad }));
  await waitFor(() => expect(refreshProfile).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByLabelText(strings.signUp.displayName).props.value).toBe('Juan'));
  expect(screen.queryByText(strings.common.couldNotLoad)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: strings.profile.save }));
  expect(updateProfile).not.toHaveBeenCalled();
});
