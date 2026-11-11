/**
 * Forgot password (12.5 centered template, D-181).
 * Sends the Supabase recovery email. The link opens reset-password through the
 * `dologram://reset-password` redirect (M0-05 allow-list); the app stays on this screen
 * and confirms that the email was sent.
 */
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ADD_ACCOUNT_PARAMS } from '../src/auth/accountSession';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { strings, validateEmail } from '@dologram/shared';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useNetState } from '../src/net/netState';
import { supabase } from '../src/lib/supabase';
import { isNetworkError, readAuthError } from '../src/auth/authError';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';

function sendLinkErrorMessage(error: unknown): string {
  const info = readAuthError(error);

  if (info.status === 429) return strings.signIn.tooManyAttempts;
  if (isNetworkError(error, info)) return strings.common.checkConnection;
  return strings.forgotPassword.failed;
}

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { addAccount } = useLocalSearchParams<{ addAccount?: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const net = useNetState();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const offline = !net.isConnected;

  async function handleSendLink() {
    if (offline || submitting) return;

    const nextEmail = email.trim();
    const nextEmailError = validateEmail(nextEmail) ? null : strings.signIn.invalidEmail;

    setEmailError(nextEmailError);
    setFormError(null);
    setSent(false);

    if (nextEmailError) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(nextEmail, {
        redirectTo: 'dologram://reset-password',
      });

      if (error) {
        setFormError(sendLinkErrorMessage(error));
        return;
      }

      setSent(true);
    } catch (error) {
      setFormError(sendLinkErrorMessage(error));
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
          {strings.forgotPassword.title}
        </Text>

        <View style={{ marginTop: theme.space[6], width: '100%' }}>
          <TextField
            label={strings.forgotPassword.email}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError(null);
              if (sent) setSent(false);
            }}
            error={emailError ?? undefined}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => {
              void handleSendLink();
            }}
            editable={!submitting}
          />
        </View>

        <View style={{ marginTop: theme.space[6], width: '100%' }}>
          <Button
            label={strings.forgotPassword.submit}
            variant="primary"
            fullWidth
            loading={submitting}
            disabled={offline}
            onPress={() => {
              void handleSendLink();
            }}
          />
        </View>

        {sent ? (
          <Text
            style={[
              textStyle(theme.typeTokens.bodySm),
              { color: theme.colors.text.secondary, marginTop: theme.space[4], textAlign: 'center' },
            ]}
            accessibilityLiveRegion="polite"
          >
            {strings.forgotPassword.sent}
          </Text>
        ) : null}

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
          onPress={() => router.replace(addAccount === '1' ? { pathname: '/sign-in', params: ADD_ACCOUNT_PARAMS } : '/sign-in')}
          accessibilityRole="link"
          accessibilityLabel={strings.forgotPassword.back}
          style={{ marginTop: theme.space[6], minHeight: 48, justifyContent: 'center' }}
        >
          <Text
            style={[
              textStyle(theme.typeTokens.bodySm),
              { color: theme.colors.brand.primary, textAlign: 'center' },
            ]}
          >
            {strings.forgotPassword.back}
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
