/**
 * Auth state for the app (M2-04, F1, D-78).
 * - Restores the stored Supabase session on start and follows onAuthStateChange.
 * - `mustChangePassword` comes from `app_metadata.must_change_password`, which only the
 *   server can set (D-78); while it is true the root guard renders AND-02 alone.
 * - The own `profiles` row is read through RLS after a normal sign-in. An RLS read before
 *   the password change returns no row by design (D-78), so the profile is loaded again
 *   when the flag clears.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { saveSessionAccount } from './savedAccounts';

export type AuthStatus = 'loading' | 'signedOut' | 'mustChangePassword' | 'signedIn';

export interface AuthProfile {
  avatar_url: string | null;
  user_id: string;
  username: string;
  display_name: string;
}

export type AuthProfileUpdate = Partial<Pick<AuthProfile, 'avatar_url' | 'username' | 'display_name'>>;

const PROFILE_AVATAR_BUCKET = 'avatars';

type ProfileRecord = AuthProfile;

async function withAvatarUrl(profile: ProfileRecord): Promise<AuthProfile> {
  if (!profile.avatar_url || profile.avatar_url.startsWith('http')) return profile;

  const { data, error } = await supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .createSignedUrl(profile.avatar_url, 60 * 60);

  return error || !data?.signedUrl ? { ...profile, avatar_url: null } : { ...profile, avatar_url: data.signedUrl };
}

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  profile: AuthProfile | null;
  refreshProfile: () => Promise<AuthProfile | null>;
  updateProfile: (updates: AuthProfileUpdate) => Promise<AuthProfile>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function requiresPasswordChange(session: Session | null): boolean {
  const flag: unknown = session?.user.app_metadata?.['must_change_password'];
  return flag === true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const profileUserIdRef = useRef<string | null>(null);
  const sessionUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session) return;
    void saveSessionAccount(session, profile).catch(() => {
      // A temporary storage failure must not interrupt the active session.
    });
  }, [session, profile]);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return null;

    profileUserIdRef.current = null;
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar_url, user_id, username, display_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    const resolvedProfile = data ? await withAvatarUrl(data) : null;
    if (sessionUserIdRef.current !== userId) return null;
    setProfile(resolvedProfile);
    profileUserIdRef.current = userId;
    return resolvedProfile;
  }, [session?.user.id]);

  const updateProfile = useCallback(
    async (updates: AuthProfileUpdate) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('No signed-in user');

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId)
        .select('avatar_url, user_id, username, display_name')
        .single();

      if (error) throw error;
      const resolvedProfile = await withAvatarUrl(data);
      if (sessionUserIdRef.current !== userId) return resolvedProfile;
      setProfile(resolvedProfile);
      profileUserIdRef.current = userId;
      return resolvedProfile;
    },
    [session?.user.id],
  );

  useEffect(() => {
    let active = true;
    let authRevision = 0;

    async function loadProfile(userId: string) {
      if (profileUserIdRef.current === userId) return;
      profileUserIdRef.current = userId;

      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url, user_id, username, display_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (!active || sessionUserIdRef.current !== userId) return;

      if (error) {
        // Denied or offline: retry on the next auth event instead of looping.
        profileUserIdRef.current = null;
        return;
      }

      const resolvedProfile = data ? await withAvatarUrl(data) : null;
      if (!active || sessionUserIdRef.current !== userId) return;
      setProfile(resolvedProfile);
    }

    function applySession(next: Session | null, loadOwnProfile: boolean) {
      if (!active) return;

      const userChanged = sessionUserIdRef.current !== (next?.user.id ?? null);
      sessionUserIdRef.current = next?.user.id ?? null;
      if (userChanged) {
        profileUserIdRef.current = null;
        setProfile(null);
      }
      setSession(next);

      if (!next) {
        profileUserIdRef.current = null;
        setProfile(null);
        setStatus('signedOut');
        return;
      }

      if (requiresPasswordChange(next)) {
        profileUserIdRef.current = null;
        setProfile(null);
        setStatus('mustChangePassword');
        return;
      }

      setStatus('signedIn');
      if (loadOwnProfile || userChanged) {
        void loadProfile(next.user.id);
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (authRevision === 0) applySession(data.session, true);
      })
      .catch(() => {
        if (active && authRevision === 0) setStatus('signedOut');
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      // supabase-js holds its auth lock while this callback runs, so further client calls are deferred.
      const revision = ++authRevision;
      setTimeout(() => {
        if (revision === authRevision) applySession(next, event !== 'TOKEN_REFRESHED');
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = { status, session, profile, refreshProfile, updateProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook to consume the auth context. Must be used inside AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
