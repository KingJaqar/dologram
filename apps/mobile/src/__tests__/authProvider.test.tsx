import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { loadSavedAccounts } from '../auth/savedAccounts';

jest.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() }, from: jest.fn() },
}));

const first = { user: { id: 'first', email: 'first@example.com' }, refresh_token: 'first-token' } as Session;
const second = { user: { id: 'second', email: 'second@example.com' }, refresh_token: 'second-token' } as Session;
const loadProfile = jest.fn();
let authChanged: (event: AuthChangeEvent, session: Session | null) => void;

beforeEach(async () => {
  await loadSavedAccounts();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: first }, error: null });
  (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((listener) => {
    authChanged = listener;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  loadProfile.mockImplementation((id: string) => Promise.resolve({ data: { user_id: id, display_name: id, username: id, avatar_url: null }, error: null }));
  (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: (_key: string, id: string) => ({ maybeSingle: () => loadProfile(id) }) }) });
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

test('token refresh persists the rotated credential and switching reloads the matching profile', async () => {
  const { result } = renderHook(useAuth, { wrapper: Wrapper });
  await waitFor(() => expect(result.current.profile?.user_id).toBe('first'));
  act(() => authChanged('TOKEN_REFRESHED', { ...first, refresh_token: 'first-rotated' }));
  await waitFor(async () => expect((await loadSavedAccounts()).find((account) => account.userId === 'first')?.refreshToken).toBe('first-rotated'));
  expect(loadProfile).toHaveBeenCalledTimes(1);

  act(() => authChanged('TOKEN_REFRESHED', second));
  await waitFor(() => expect(result.current.profile?.user_id).toBe('second'));
  await waitFor(async () => expect((await loadSavedAccounts()).find((account) => account.userId === 'second')?.displayName).toBe('second'));
});

test('a previous account profile response cannot overwrite the new account', async () => {
  let finishFirst: (value: unknown) => void = () => {};
  loadProfile.mockImplementation((id: string) => id === 'first'
    ? new Promise((resolve) => { finishFirst = resolve; })
    : Promise.resolve({ data: { user_id: id, display_name: id, username: id, avatar_url: null }, error: null }));
  const { result } = renderHook(useAuth, { wrapper: Wrapper });
  await waitFor(() => expect(loadProfile).toHaveBeenCalledWith('first'));
  act(() => authChanged('SIGNED_IN', second));
  await waitFor(() => expect(result.current.profile?.user_id).toBe('second'));
  await act(async () => finishFirst({ data: { user_id: 'first', display_name: 'first', username: 'first', avatar_url: null }, error: null }));
  expect(result.current.profile?.user_id).toBe('second');
});
