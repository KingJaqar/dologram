/**
 * AND-02 Change password (12.5 forced password change template, M2-04, D-47, D-78).
 * While the account carries app_metadata.must_change_password the screen is the only
 * reachable route and the Android back button does nothing. Opened from Settings, it has
 * a back button and keeps the signed-in session.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { strings, validateNewPassword } from '@dologram/shared';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useNetState } from '../src/net/netState';
import { useAuth } from '../src/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { Button, IconButton } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { TopBar } from '../src/components/TopBar';
import { goBackOrReplace } from '../src/navigation/goBackOrReplace';

/** 422 is Supabase Auth's weak-password rejection; 429 is its rate limit. */
function passwordErrorMessage(error: unknown): string {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status
      : undefined;

  if (status === 422) return strings.changePassword.tooShort;
  if (status === 429) return strings.signIn.tooManyAttempts;
  return strings.common.checkConnection;
}

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { status } = useAuth();
  const net = useNetState();

  const forced = status === 'mustChangePassword';
  // Captured once: after a successful save the status turns signedIn and the screen must
  // still know whether this visit was forced (no back button) or came from Settings.
  const forcedOnMount = useRef(forced).current;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const offline = !net.isConnected;

  // 11.2: on AND-02 while forced the Android back button does nothing.
  useEffect(() => {
    if (!forced) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [forced]);

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
        setFormError(passwordErrorMessage(error));
        return;
      }

      // D-78: the server clears the flag when the password changes; the refreshed session
      // carries a JWT without it. Database access does not wait for this (D-86).
      await supabase.auth.refreshSession();

      if (forcedOnMount) {
        router.replace('/(main)/(tabs)');
      } else {
        goBackOrReplace(router, '/(main)/(tabs)/settings');
      }
    } catch (error) {
      setFormError(passwordErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg.app }}>
      <TopBar
        title={strings.changePassword.title}
        onBack={forced ? undefined : () => goBackOrReplace(router, '/(main)/(tabs)/settings')}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: height > 700 ? theme.space[8] : theme.space[6],
            paddingBottom: insets.bottom + theme.space[6],
            paddingHorizontal: theme.space[6],
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          <Text style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.text.primary }]}>
            {strings.changePassword.body}
          </Text>

          <View style={{ marginTop: theme.space[6], width: '100%' }}>
            <TextField
              label={strings.changePassword.newPassword}
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (newError) setNewError(null);
              }}
              helper={strings.changePassword.helper}
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
              label={strings.changePassword.confirmPassword}
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
              label={strings.changePassword.save}
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
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%', maxWidth: 400 },
});
