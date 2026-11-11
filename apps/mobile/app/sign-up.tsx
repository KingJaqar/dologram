/**
 * AND-01b Create account (12.5 centered template, D-163).
 * Self-service sign-up with email, password, username and display name. Email confirmation
 * is off (D-163), so a successful signUp returns a session, onAuthStateChange reports
 * SIGNED_IN and the root guard opens the chat list; self-created accounts never carry
 * must_change_password, so AND-02 is skipped.
 *
 * On success a centered dialog confirms account creation. The user taps "Sign in" to
 * navigate to the sign-in screen (D-163 rev, 2026-11-09).
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
import {
  dgTrim,
  strings,
  validateDisplayName,
  validateEmail,
  validateNewPassword,
  validateUsername,
} from '@dologram/shared';
import { useToast } from '../src/components/Toast';
import { actionToast } from '../src/notifications/toastCopy';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useNetState } from '../src/net/netState';
import { createAccountAuthClient, supabase } from '../src/lib/supabase';
import { useAuth } from '../src/auth/AuthProvider';
import { activateAccountSession, ADD_ACCOUNT_PARAMS } from '../src/auth/accountSession';
import { isNetworkError, readAuthError } from '../src/auth/authError';
import { Button, IconButton } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { Dialog } from '../src/components/Dialog';

/** Single rule row shared by PasswordRequirements and ConfirmMatch. */
function RuleRow({ met, label }: { met: boolean; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: met ? theme.colors.brand.primary : theme.colors.text.muted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {met ? (
          <Text style={{ color: theme.colors.text.inverse, fontSize: 10, fontWeight: '700', lineHeight: 14 }}>
            ✓
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          textStyle(theme.typeTokens.bodySm),
          { color: met ? theme.colors.text.primary : theme.colors.text.secondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Real-time password requirements (D-47, config.password.minLength = 12).
 * Hidden until the user starts typing.
 */
function PasswordRequirements({ password }: { password: string }) {
  const len = [...password].length; // code-point-aware
  if (len === 0) return null;
  return (
    <View style={{ marginTop: 6, gap: 4 }}>
      <RuleRow met={len >= 12} label="At least 12 characters" />
    </View>
  );
}

/**
 * Real-time confirm-password match indicator.
 * Only appears once the user has typed something in the confirm field.
 */
function ConfirmMatch({ password, confirm }: { password: string; confirm: string }) {
  if (confirm.length === 0) return null;
  const matches = password === confirm;
  return (
    <View style={{ marginTop: 6, gap: 4 }}>
      <RuleRow met={matches} label={matches ? 'Passwords match' : "Passwords don't match"} />
    </View>
  );
}

type UsernameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error';

/**
 * Real-time username requirements + availability check (D-89, M1-03).
 * Shows format rules immediately; once the format is valid it debounces
 * 600 ms then calls the find_user RPC to check uniqueness.
 * Hidden when the field is empty.
 */
function UsernameRequirements({
  username,
  status,
}: {
  username: string;
  status: UsernameStatus;
}) {
  if (username.length === 0) return null;

  const formatOk = validateUsername(username);

  // Availability label/colour derived from status
  let availLabel = '';
  let availMet: boolean | null = null;
  if (formatOk) {
    if (status === 'checking') { availLabel = strings.signUp.usernameChecking; availMet = null; }
    else if (status === 'available') { availLabel = strings.signUp.usernameAvailable; availMet = true; }
    else if (status === 'taken') { availLabel = strings.signUp.usernameTaken; availMet = false; }
  }

  return (
    <View style={{ marginTop: 6, gap: 4 }}>
      <RuleRow met={formatOk} label="5–32 characters, starts with a letter, letters/numbers/underscores only" />
      {availLabel ? (
        availMet === null ? (
          // Checking spinner row — neutral colour
          <CheckingRow label={availLabel} />
        ) : (
          <RuleRow met={availMet} label={availLabel} />
        )
      ) : null}
    </View>
  );
}

/** Neutral "Checking…" row — no dot colour indicates pass/fail. */
function CheckingRow({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: theme.colors.text.muted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
      <Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.text.secondary }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * D-163 error mapping. GoTrue reports an existing email as `user_already_exists`; the
 * new-user trigger propagates a username unique violation (prerequisite M1-03), which
 * surfaces as a duplicate-key message. Anything unrecognised keeps a generic message.
 */
function signUpErrorMessage(error: unknown): string {
  const info = readAuthError(error);
  const message = info.message.toLowerCase();

  if (info.status === 429) return strings.signIn.tooManyAttempts;
  if (info.code === 'user_already_exists' || message.includes('already registered')) {
    return strings.signUp.emailTaken;
  }
  if (message.includes('username') || message.includes('duplicate key')) {
    return strings.signUp.usernameTaken;
  }
  if (info.status === 422 && message.includes('password')) {
    return strings.changePassword.tooShort;
  }
  if (info.status === 400 && message.includes('email')) return strings.signIn.invalidEmail;
  if (isNetworkError(error, info)) return strings.common.checkConnection;
  return strings.signUp.failed;
}

export default function SignUpScreen() {
  const submitLock = useRef(false);
  const { showToast } = useToast();
  const theme = useTheme();
  const router = useRouter();
  const { addAccount } = useLocalSearchParams<{ addAccount?: string }>();
  const addingAccount = addAccount === '1';
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const net = useNetState();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Username availability check — debounced 600 ms after format becomes valid
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);

    if (!validateUsername(username)) {
      return;
    }

    usernameTimerRef.current = setTimeout(async () => {
      setUsernameStatus('checking');
      try {
        const { data } = await supabase.rpc('find_user', { username });
        // find_user returns [] when the username is free, or [{...}] when taken
        setUsernameStatus(Array.isArray(data) && data.length > 0 ? 'taken' : 'available');
      } catch {
        setUsernameStatus('error');
      }
    }, 600);

    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    };
  }, [username]);

  const offline = !net.isConnected;

  function reportFailure(message: string) {
    setFormError(message);
    showToast({ ...actionToast('createAccount', 'error'), message });
  }

  async function handleCreateAccount() {
    if (offline || submitLock.current) return;

    const nextEmail = email.trim();
    const nextDisplayName = dgTrim(displayName);

    const nextEmailError = validateEmail(nextEmail) ? null : strings.signIn.invalidEmail;
    const nextPasswordError = validateNewPassword(password)
      ? null
      : password.length === 0
        ? strings.signUp.passwordRequired
        : strings.changePassword.tooShort;
    const nextConfirmError =
      password === confirmPassword ? null : strings.changePassword.mismatch;
    const nextUsernameError = !validateUsername(username)
      ? strings.signUp.usernameInvalid
      : usernameStatus === 'taken'
        ? strings.signUp.usernameTaken
        : usernameStatus === 'checking'
          ? strings.signUp.usernameChecking
          : null;
    const nextDisplayNameError = validateDisplayName(nextDisplayName)
      ? null
      : strings.signUp.displayNameRequired;

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    setUsernameError(nextUsernameError);
    setDisplayNameError(nextDisplayNameError);
    setFormError(null);

    if (
      nextEmailError ||
      nextPasswordError ||
      nextConfirmError ||
      nextUsernameError ||
      nextDisplayNameError
    ) {
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    try {
      const client = addingAccount ? createAccountAuthClient() : supabase;
      const { data, error } = await client.auth.signUp({
        email: nextEmail,
        password,
        options: { data: { username, display_name: nextDisplayName } },
      });

      if (error) {
        reportFailure(signUpErrorMessage(error));
        return;
      }
      if (!data?.user && !data?.session) throw new Error('Missing created account');
      if (addingAccount && data.session) {
        await activateAccountSession(data.session, session?.user.id, profile);
        showToast(actionToast('createAccount', 'success'));
        router.replace('/(main)/(tabs)');
        return;
      }

      // With confirmation off a session always comes back. Show the success dialog
      // regardless; if somehow no session comes back the dialog still guides the user
      // to sign in manually.
      showToast(actionToast('createAccount', 'success'));
      setShowSuccess(true);
    } catch (error) {
      reportFailure(signUpErrorMessage(error));
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
          paddingTop: insets.top + (height > 700 ? 48 : 24),
          paddingBottom: insets.bottom + theme.space[6],
          paddingHorizontal: theme.space[6],
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Success dialog — appears after a confirmed account creation */}
      <Dialog
        visible={showSuccess}
        title={strings.signUp.successTitle}
        message={strings.signUp.successMessage}
        confirmLabel={strings.signUp.successOk}
        dismissLabel=""
        onConfirm={() => {
          setShowSuccess(false);
          router.replace(addingAccount ? { pathname: '/sign-in', params: ADD_ACCOUNT_PARAMS } : '/sign-in');
        }}
        onDismiss={() => {
          setShowSuccess(false);
          router.replace(addingAccount ? { pathname: '/sign-in', params: ADD_ACCOUNT_PARAMS } : '/sign-in');
        }}
      />
      <View style={styles.column}>
        <Text style={[textStyle(theme.typeTokens.display), { color: theme.colors.brand.primary }]}>
          DoloGram
        </Text>

        <Text
          style={[
            textStyle(theme.typeTokens.titleLg),
            { color: theme.colors.text.primary, marginTop: theme.space[6] },
          ]}
          accessibilityRole="header"
        >
          {strings.signUp.title}
        </Text>

        <View style={{ marginTop: theme.space[5], width: '100%' }}>
          <TextField
            label={strings.signUp.email}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError(null);
            }}
            error={emailError ?? undefined}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            editable={!submitting}
          />

          <View style={{ height: theme.space[4] }} />

          <TextField
            label={strings.signUp.password}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError(null);
              // re-evaluate match hint when password changes
              if (confirmError) setConfirmError(null);
            }}
            error={passwordError ?? undefined}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            autoCorrect={false}
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

          <PasswordRequirements password={password} />

          <View style={{ height: theme.space[4] }} />

          <TextField
            label={strings.signUp.confirmPassword}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (confirmError) setConfirmError(null);
            }}
            error={confirmError ?? undefined}
            secureTextEntry={!showConfirm}
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            trailing={
              <IconButton
                iconName={showConfirm ? 'action.hidePassword' : 'action.showPassword'}
                accessibilityLabel={
                  showConfirm ? strings.action.hidePassword : strings.action.showPassword
                }
                onPress={() => setShowConfirm((visible) => !visible)}
              />
            }
          />

          <ConfirmMatch password={password} confirm={confirmPassword} />

          <View style={{ height: theme.space[4] }} />

          <TextField
            label={strings.signUp.username}
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setUsernameStatus(validateUsername(text) ? 'checking' : 'idle');
              if (usernameError) setUsernameError(null);
            }}
            error={usernameError ?? undefined}
            autoComplete="username-new"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
          />

          <UsernameRequirements username={username} status={usernameStatus} />

          <View style={{ height: theme.space[4] }} />

          <TextField
            label={strings.signUp.displayName}
            value={displayName}
            onChangeText={(text) => {
              setDisplayName(text);
              if (displayNameError) setDisplayNameError(null);
            }}
            error={displayNameError ?? undefined}
            autoComplete="name"
            autoCapitalize="words"
            returnKeyType="go"
            onSubmitEditing={() => {
              void handleCreateAccount();
            }}
            editable={!submitting}
          />
        </View>

        <View style={{ marginTop: theme.space[6], width: '100%' }}>
          <Button
            label={strings.signUp.submit}
            variant="primary"
            fullWidth
            loading={submitting}
            disabled={offline}
            onPress={() => {
              void handleCreateAccount();
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
          onPress={() => router.replace(addingAccount ? { pathname: '/sign-in', params: ADD_ACCOUNT_PARAMS } : '/sign-in')}
          accessibilityRole="link"
          accessibilityLabel={strings.signUp.signInLink}
          style={{ marginTop: theme.space[6], minHeight: 48, justifyContent: 'center' }}
        >
          <Text
            style={[
              textStyle(theme.typeTokens.bodySm),
              { color: theme.colors.brand.primary, textAlign: 'center' },
            ]}
          >
            {strings.signUp.signInLink}
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
