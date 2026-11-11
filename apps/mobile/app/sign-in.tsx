/**
 * AND-01 Sign-in (12.5 sign-in template, M2-04, F1, D-47, rev. 2026-11-09).
 *
 * Changes from original:
 * - Accepts email OR username in a single identifier field.
 *   Username input is exchanged for an Auth session by the pre-login Edge Function.
 * - "Save login info" toggle (SwitchRow) persists the last-used identifier to
 *   AsyncStorage key `dg.savedLogin` and pre-fills it on next open.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { strings, validateEmail, validateUsername } from '@dologram/shared';
import { useToast } from '../src/components/Toast';
import { actionToast } from '../src/notifications/toastCopy';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useNetState } from '../src/net/netState';
import { createAccountAuthClient, supabase } from '../src/lib/supabase';
import { useAuth } from '../src/auth/AuthProvider';
import { activateAccountSession, ADD_ACCOUNT_PARAMS } from '../src/auth/accountSession';
import { Button, IconButton } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { SwitchRow } from '../src/components/SwitchRow';
import { loadSavedAccounts } from '../src/auth/savedAccounts';

/** AsyncStorage key for the saved identifier. */
const SAVED_LOGIN_KEY = 'dg.savedLogin';

/**
 * Detects whether the input is an email, a valid username, or neither.
 * Used to decide sign-in strategy and to validate before submit.
 */
function classifyIdentifier(value: string): 'email' | 'username' | 'invalid' {
  if (validateEmail(value)) return 'email';
  if (validateUsername(value)) return 'username';
  return 'invalid';
}

/**
 * AND-01 defines three failure messages: wrong credentials, rate limit, connection.
 * GoTrue answers a wrong email/password with 400; repeated attempts hit 429.
 */
function signInErrorMessage(error: unknown, identifierType: 'email' | 'username'): string {
  const status = getErrorStatus(error);

  if (status === 400 || status === 401) {
    return identifierType === 'username'
      ? strings.signIn.wrongCredentialsUsername
      : strings.signIn.wrongCredentials;
  }
  if (status === 429) return strings.signIn.tooManyAttempts;
  return strings.common.checkConnection;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  if ('status' in error && typeof (error as { status?: unknown }).status === 'number') {
    return (error as { status: number }).status;
  }

  const context = 'context' in error ? (error as { context?: unknown }).context : undefined;
  if (typeof context === 'object' && context !== null && 'status' in context) {
    const status = (context as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }

  return undefined;
}

export default function SignInScreen() {
  const submitLock = useRef(false);
  const { showToast } = useToast();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const net = useNetState();
  const { session, profile } = useAuth();
  const params = useLocalSearchParams<{ addAccount?: string; identifier?: string }>();
  const addingAccount = params.addAccount === '1';

  const [identifier, setIdentifier] = useState(params.identifier ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveLogin, setSaveLogin] = useState(false);
  const [hasSavedAccounts, setHasSavedAccounts] = useState(false);

  const offline = !net.isConnected;

  function reportFailure(message: string) {
    setFormError(message);
    showToast({ ...actionToast('login', 'error'), message });
  }

  // Restore saved login info on mount
  useEffect(() => {
    AsyncStorage.getItem(SAVED_LOGIN_KEY)
      .then((saved) => {
        if (saved && !params.identifier) {
          setIdentifier(saved);
          setSaveLogin(true);
        }
      })
      .catch(() => {
        // Ignore storage errors — form starts empty
      });
  }, [params.identifier]);

  // Manage Accounts is available whenever at least one account is saved locally.
  useEffect(() => {
    let mounted = true;
    void loadSavedAccounts().then((accounts) => {
      if (mounted) setHasSavedAccounts(accounts.length > 0);
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSignIn() {
    if (offline || submitLock.current) return;

    const trimmedIdentifier = identifier.trim();
    const kind = classifyIdentifier(trimmedIdentifier);

    const nextIdentifierError =
      trimmedIdentifier.length === 0 || kind === 'invalid'
        ? strings.signIn.invalidIdentifier
        : null;
    const nextPasswordError =
      password.length === 0 ? strings.signIn.passwordRequired : null;

    setIdentifierError(nextIdentifierError);
    setPasswordError(nextPasswordError);
    setFormError(null);

    if (nextIdentifierError || nextPasswordError) return;

    submitLock.current = true;
    setSubmitting(true);
    try {
      const client = addingAccount ? createAccountAuthClient() : supabase;
      let emailToUse = trimmedIdentifier;

      // Username sign-in is handled server-side so the account email is never exposed to the
      // device before authentication.
      if (kind === 'username') {
        const { data, error: functionError } = await client.functions.invoke(
          'sign-in-username',
          {
            body: { username: trimmedIdentifier, password },
          },
        );
        if (functionError) {
          reportFailure(signInErrorMessage(functionError, 'username'));
          return;
        }

        const nextSession = (
          data as {
            session?: { access_token?: string; refresh_token?: string };
          } | null
        )?.session;
        if (!nextSession?.access_token || !nextSession.refresh_token) {
          reportFailure(strings.common.checkConnection);
          return;
        }

        const tokens = { access_token: nextSession.access_token, refresh_token: nextSession.refresh_token };
        const { data: restored, error: sessionError } = await client.auth.setSession(tokens);
        if (sessionError) {
          reportFailure(signInErrorMessage(sessionError, 'username'));
          return;
        }
        if (!restored?.session) throw new Error('Missing account session');
        if (addingAccount) {
          await activateAccountSession(restored.session, session?.user.id, profile);
        }

        if (saveLogin) {
          await AsyncStorage.setItem(SAVED_LOGIN_KEY, trimmedIdentifier).catch(() => undefined);
        } else {
          await AsyncStorage.removeItem(SAVED_LOGIN_KEY).catch(() => undefined);
        }
        showToast(actionToast('login', 'success'));
        if (addingAccount) router.replace('/(main)/(tabs)');
        return;
      }

      const { data, error } = await client.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (error) {
        reportFailure(signInErrorMessage(error, 'email'));
        return;
      }
      if (!data?.session) throw new Error('Missing account session');
      if (addingAccount) {
        await activateAccountSession(data.session, session?.user.id, profile);
      }

      // Persist or clear saved login
      if (saveLogin) {
        await AsyncStorage.setItem(SAVED_LOGIN_KEY, trimmedIdentifier).catch(() => undefined);
      } else {
        await AsyncStorage.removeItem(SAVED_LOGIN_KEY).catch(() => undefined);
      }
      showToast(actionToast('login', 'success'));
        if (addingAccount) router.replace('/(main)/(tabs)');
    } catch (error) {
      reportFailure(signInErrorMessage(error, kind === 'username' ? 'username' : 'email'));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg.app }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (height > 700 ? 64 : 32),
          paddingBottom: insets.bottom + theme.space[6],
          paddingHorizontal: theme.space[6],
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.column}>
        <Text style={[textStyle(theme.typeTokens.display), { color: theme.colors.brand.primary }]}>
          DoloGram
        </Text>

        <Text
          style={[
            textStyle(theme.typeTokens.titleLg),
            { color: theme.colors.text.primary, marginTop: theme.space[8] },
          ]}
          accessibilityRole="header"
        >
          {strings.signIn.title}
        </Text>

        <View style={{ marginTop: theme.space[6], width: '100%' }}>
          <TextField
            label={strings.signIn.emailOrUsername}
            value={identifier}
            onChangeText={(text) => {
              setIdentifier(text);
              if (identifierError) setIdentifierError(null);
            }}
            error={identifierError ?? undefined}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            editable={!submitting}
          />

          <View style={{ height: theme.space[4] }} />

          <TextField
            label={strings.signIn.password}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError(null);
            }}
            error={passwordError ?? undefined}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            textContentType="password"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => {
              void handleSignIn();
            }}
            editable={!submitting}
            trailing={
              <IconButton
                iconName={showPassword ? 'action.hidePassword' : 'action.showPassword'}
                accessibilityLabel={
                  showPassword ? strings.action.hidePassword : strings.action.showPassword
                }
                onPress={() => setShowPassword((visible) => !visible)}
              />
            }
          />

          <View style={{ height: theme.space[2] }} />

          <SwitchRow
            label={strings.signIn.saveLogin}
            value={saveLogin}
            onValueChange={setSaveLogin}
            disabled={submitting}
          />
        </View>

        <View style={{ marginTop: theme.space[4], width: '100%' }}>
          <Button
            label={strings.signIn.title}
            variant="primary"
            fullWidth
            loading={submitting}
            disabled={offline}
            onPress={() => {
              void handleSignIn();
            }}
          />
        </View>

        {formError ? (
          <Text
            style={[
              textStyle(theme.typeTokens.bodySm),
              { color: theme.colors.error.text, marginTop: theme.space[4], textAlign: 'center' },
            ]}
            accessibilityRole="alert"
          >
            {formError}
          </Text>
        ) : null}

        {offline ? (
          <Text
            style={[
              textStyle(theme.typeTokens.bodySm),
              { color: theme.colors.text.secondary, marginTop: theme.space[4], textAlign: 'center' },
            ]}
          >
            {strings.common.noConnection}
          </Text>
        ) : null}

        <Pressable
          onPress={() => router.push(addingAccount ? { pathname: '/forgot-password', params: ADD_ACCOUNT_PARAMS } : '/forgot-password')}
          accessibilityRole="link"
          accessibilityLabel={strings.signIn.forgot}
          style={{ marginTop: theme.space[2], minHeight: 48, justifyContent: 'center' }}
        >
          <Text
            style={[
              textStyle(theme.typeTokens.bodySm),
              { color: theme.colors.text.secondary, textAlign: 'center' },
            ]}
          >
            {strings.signIn.forgot}
          </Text>
        </Pressable>

        {hasSavedAccounts ? (
          // The account list is stored locally, so opening it must not require a
          // session refresh or turn a saved-account problem into a network error.
          <Pressable
            onPress={() => router.replace('/manage-accounts')}
            accessibilityRole="button"
            accessibilityLabel={strings.signIn.manageAccounts}
            style={{
              marginTop: theme.space[2],
              minHeight: 48,
              justifyContent: 'center',
            }}
          >
            <Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.text.secondary, textAlign: 'center' }]}>
              {strings.signIn.manageAccounts}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => router.push(addingAccount ? { pathname: '/sign-up', params: ADD_ACCOUNT_PARAMS } : '/sign-up')}
          accessibilityRole="link"
          accessibilityLabel={strings.signIn.createAccount}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Text
            style={[
              textStyle(theme.typeTokens.bodySm),
              { color: theme.colors.brand.primary, textAlign: 'center' },
            ]}
          >
            {strings.signIn.createAccount}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%', maxWidth: 400, alignItems: 'center' },
});
