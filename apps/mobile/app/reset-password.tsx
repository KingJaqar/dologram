/**
 * Reset password (12.5 centered template, D-181).
 * Opened by the `dologram://reset-password?code=...` recovery link. The code is exchanged
 * for a session once, then the user sets a new password (the AND-02 rule: at least 12
 * characters, both fields equal) and lands on the chat list.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { strings, validateNewPassword } from '@dologram/shared';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useNetState } from '../src/net/netState';
import { supabase } from '../src/lib/supabase';
import { isNetworkError, readAuthError } from '../src/auth/authError';
import { Button, IconButton } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { useDelayedFlag } from '../src/hooks/useDelayedFlag';

/** A recovery code that Auth rejects (expired, already used) versus an unreachable server. */
function resetLinkErrorMessage(error: unknown): string {
  const info = readAuthError(error);

  if (isNetworkError(error, info)) return strings.common.checkConnection;
  return strings.resetPassword.expiredLink;
}

function saveErrorMessage(error: unknown): string {
  const info = readAuthError(error);
  const message = info.message.toLowerCase();

  if (info.status === 429) return strings.signIn.tooManyAttempts;
  if (info.status === 422 && message.includes('password')) {
    return strings.changePassword.tooShort;
  }
  if (isNetworkError(error, info)) return strings.common.checkConnection;
  return strings.resetPassword.saveFailed;
}

type Phase = 'exchanging' | 'ready' | 'failed';

/** Result of exchanging one recovery code; state is keyed by the code it belongs to. */
interface ExchangeState {
  code: string;
  ok: boolean;
  failure: string | null;
}

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const net = useNetState();
  const params = useLocalSearchParams<{ code?: string | string[] }>();

  const code = Array.isArray(params.code) ? params.code[0] : params.code;

  const [exchange, setExchange] = useState<ExchangeState | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const offline = !net.isConnected;

  const settled = code && exchange?.code === code ? exchange : null;
  const phase: Phase = !code ? 'failed' : settled ? (settled.ok ? 'ready' : 'failed') : 'exchanging';
  const showExchanging = useDelayedFlag(phase === 'exchanging');
  const failure = !code
    ? strings.resetPassword.expiredLink
    : settled && !settled.ok
      ? settled.failure
      : null;

  useEffect(() => {
    if (!code) return;

    let active = true;

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (!active) return;
        setExchange({
          code,
          ok: !error,
          failure: error ? resetLinkErrorMessage(error) : null,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setExchange({ code, ok: false, failure: resetLinkErrorMessage(error) });
      });

    return () => {
      active = false;
    };
  }, [code]);

  async function handleSave() {
    if (offline || submitting) return;

    const nextNewError = validateNewPassword(newPassword)
      ? null
      : strings.changePassword.tooShort;
    const nextConfirmError =
      newPassword === confirmPassword ? null : strings.changePassword.mismatch;

    setNewError(nextNewError);
    setConfirmError(nextConfirmError);
    setFormError(null);

    if (nextNewError || nextConfirmError) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setFormError(saveErrorMessage(error));
        return;
      }

      router.replace('/(main)/(tabs)');
    } catch (error) {
      setFormError(saveErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg.app }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + theme.space[10],
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
          {strings.resetPassword.title}
        </Text>

        {showExchanging ? (
          <View style={{ marginTop: theme.space[8] }} accessibilityLabel="Loading">
            <ActivityIndicator
              size="small"
              color={theme.colors.brand.primary}
              accessibilityLabel="Loading"
            />
          </View>
        ) : null}

        {phase === 'failed' ? (
          <>
            <Text
              style={[
                textStyle(theme.typeTokens.bodyMd),
                {
                  color: theme.colors.error.text,
                  marginTop: theme.space[6],
                  textAlign: 'center',
                },
              ]}
              accessibilityRole="alert"
            >
              {failure}
            </Text>

            <View style={{ marginTop: theme.space[6], width: '100%' }}>
              <Button
                label={strings.resetPassword.requestNew}
                variant="primary"
                fullWidth
                onPress={() => router.replace('/forgot-password')}
              />
            </View>

            <Pressable
              onPress={() => router.replace('/sign-in')}
              accessibilityRole="link"
              accessibilityLabel={strings.resetPassword.back}
              style={{ marginTop: theme.space[4], minHeight: 48, justifyContent: 'center' }}
            >
              <Text
                style={[
                  textStyle(theme.typeTokens.bodySm),
                  { color: theme.colors.brand.primary, textAlign: 'center' },
                ]}
              >
                {strings.resetPassword.back}
              </Text>
            </Pressable>
          </>
        ) : null}

        {phase === 'ready' ? (
          <>
            <View style={{ marginTop: theme.space[6], width: '100%' }}>
              <TextField
                label={strings.resetPassword.newPassword}
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (newError) setNewError(null);
                }}
                helper={strings.resetPassword.helper}
                error={newError ?? undefined}
                secureTextEntry={!showNew}
                autoComplete="new-password"
                textContentType="newPassword"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
                trailing={
                  <IconButton
                    iconName={showNew ? 'action.hidePassword' : 'action.showPassword'}
                    accessibilityLabel={
                      showNew ? strings.action.hidePassword : strings.action.showPassword
                    }
                    onPress={() => setShowNew((visible) => !visible)}
                  />
                }
              />

              <View style={{ height: theme.space[4] }} />

              <TextField
                label={strings.resetPassword.confirm}
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
                returnKeyType="go"
                onSubmitEditing={() => {
                  void handleSave();
                }}
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
            </View>

            <View style={{ marginTop: theme.space[6], width: '100%' }}>
              <Button
                label={strings.resetPassword.save}
                variant="primary"
                fullWidth
                loading={submitting}
                disabled={offline}
                onPress={() => {
                  void handleSave();
                }}
              />
            </View>

            {formError ? (
              <Text
                style={[
                  textStyle(theme.typeTokens.bodySm),
                  {
                    color: theme.colors.error.text,
                    marginTop: theme.space[4],
                    textAlign: 'center',
                  },
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
                  {
                    color: theme.colors.text.secondary,
                    marginTop: theme.space[4],
                    textAlign: 'center',
                  },
                ]}
              >
                {strings.common.noConnection}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%', maxWidth: 400, alignItems: 'center' },
});
