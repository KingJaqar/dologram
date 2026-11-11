/**
 * Root layout — wraps the app in ThemeProvider, SafeAreaProvider, ToastProvider and AuthProvider.
 * Loads Inter and JetBrains Mono fonts and holds the splash screen until fonts and the
 * stored session are ready. Phase 4 Step 3 adds the auth guard (M2-04, D-78).
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, Stack, useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { actionToast } from '../src/notifications/toastCopy';
import { subscribeForwardOutcome } from '../src/queue/events';
import { ToastProvider, useToast } from '../src/components/Toast';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { CallProvider } from '../src/calls/CallProvider';
import { startQueueWorker } from '../src/queue/worker';
import { startSync } from '../src/sync/lifecycle';
import {
  clearNotificationResponse,
  startPushNotifications,
  subscribeNotificationResponses,
} from '../src/notifications/pushNotifications';

// Prevent the splash screen from auto-hiding until fonts and the session are loaded.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
  });

  // Assumption A-07: both font packages work on SDK 57.
  // Fallback: if fontError is set, we continue with system fonts rather than blocking the app.
  const fontsReady = fontsLoaded || Boolean(fontError);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <RootNavigator fontsReady={fontsReady} />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { status, session } = useAuth();
  const { showToast, hideToast, setScope } = useToast();
  useEffect(() => subscribeForwardOutcome((outcome) => {
    if (outcome.userId !== session?.user.id) return;
    hideToast(`forward-queued:${outcome.messageId}`);
    showToast({ ...actionToast('forwardMessage', outcome.status === 'sent' ? 'success' : 'error'), id: `forward:${outcome.messageId}:${outcome.status}` });
  }), [session?.user.id, showToast, hideToast]);
  const currentUserId = status === 'signedIn' ? session?.user.id ?? null : null;
  useEffect(() => { if (status !== 'loading') setScope(currentUserId); }, [currentUserId, setScope, status]);
  const segments = useSegments();
  const { addAccount } = useGlobalSearchParams<{ addAccount?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const handledNotificationRef = React.useRef<string | null>(null);

  // Keep the splash screen up until fonts and the stored session are both known, so a
  // forced password change never flashes the chat list first (D-78).
  useEffect(() => {
    if (fontsReady && status !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [fontsReady, status]);

  // LS-3: the delivery worker runs only for a signed-in user and only in the foreground.
  // M2-05: the sync engine follows the same session, subscribes to the published tables and
  // resyncs on every foreground and reconnect.
  useEffect(() => {
    if (status !== 'signedIn') return;
    const worker = startQueueWorker();
    const sync = startSync();
    return () => {
      sync.stop();
      worker.stop();
    };
  }, [status, currentUserId]);

  useEffect(() => {
    if (currentUserId) return startPushNotifications(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || !fontsReady) return;
    return subscribeNotificationResponses((response) => {
      const { content, identifier } = response.notification.request;
      const data = content.data;
      const callId = data && typeof data === 'object' && 'call_id' in data && typeof data.call_id === 'string'
        ? data.call_id
        : null;
      const chatId = data && typeof data === 'object' && 'chat_id' in data && typeof data.chat_id === 'string'
        ? data.chat_id
        : null;
      if ((!chatId && !callId) || handledNotificationRef.current === identifier) return;
      handledNotificationRef.current = identifier;
      clearNotificationResponse();
      if (callId) {
        router.push({ pathname: '/call/[callId]', params: { callId } });
      } else if (chatId) {
        router.push({ pathname: '/chat/[chatId]', params: { chatId } });
      }
    });
  }, [currentUserId, fontsReady, router]);

  // M2-04 guard: signed-out → AND-01 (Manage Accounts is local); must change password → AND-02 only; signed-in → leave
  // the signed-out screens. Sign-up (AND-01b) and the password-reset screens are reachable
  // while signed out (D-163, D-181). `/change-password` and `/reset-password` stay reachable
  // while signed in: Settings opens AND-02 (D-51) and the recovery exchange creates the session
  // before the new password is saved (D-181).
  useEffect(() => {
    if (status === 'loading') return;

    const root = segments[0];
    const signedOutRoute =
      root === 'sign-in' ||
      root === 'sign-up' ||
      root === 'forgot-password' ||
      root === 'reset-password' ||
      root === 'manage-accounts';
    const onChangePassword = root === 'change-password';
    const signedInOnlyRoute =
      root === 'sign-in' || root === 'sign-up' || root === 'forgot-password';

    if (status === 'signedOut') {
      if (!signedOutRoute) router.replace('/sign-in');
      return;
    }

    if (status === 'mustChangePassword') {
      if (!onChangePassword) router.replace('/change-password');
      return;
    }

    if (signedInOnlyRoute && addAccount !== '1') router.replace('/(main)/(tabs)');
  }, [status, segments, router, addAccount]);

  if (!fontsReady || status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: theme.colors.bg.app }} />;
  }

  return (
    <NavigationThemeProvider value={{
      ...(theme.scheme === 'dark' ? DarkTheme : DefaultTheme),
      colors: {
        ...(theme.scheme === 'dark' ? DarkTheme : DefaultTheme).colors,
        background: theme.colors.bg.app,
        card: theme.colors.bg.chatList,
        text: theme.colors.text.primary,
        primary: theme.colors.brand.primary,
        border: theme.colors.separator,
      },
    }}>
    <CallProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.bg.app }}>
        <Stack
          initialRouteName="(main)"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.bg.app },
            statusBarStyle: theme.scheme === 'dark' ? 'light' : 'dark',
            navigationBarColor: theme.colors.bg.app,
            navigationBarTranslucent: false,
          }}
        >
        {/*
         * Keep the authenticated index group first. The root stack uses the
         * declared screen order when it builds its initial state; registering
         * the forward modal first made a cold start open `/forward` without
         * the message parameters that route requires.
         */}
        <Stack.Screen name="(main)" options={{ freezeOnBlur: false }} />
        <Stack.Screen name="forward" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="search"
          options={{ animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
        />
        <Stack.Screen
          name="chat/[chatId]"
          options={{
            // Keep the route transition on the native UI thread. This avoids the
            // flicker and dropped frames caused by animating the chat tree in JS.
            animation: theme.reduceMotion ? 'none' : 'slide_from_right',
            freezeOnBlur: true,
            contentStyle: { backgroundColor: theme.colors.bg.chat },
            // Keep the same system-bar surface on both sides of the transition.
            navigationBarColor: theme.colors.bg.app,
            navigationBarTranslucent: false,
          }}
        />
          <Stack.Screen
            name="call/[callId]"
            options={{
              presentation: 'modal',
              animation: theme.reduceMotion ? 'none' : 'slide_from_bottom',
              freezeOnBlur: false,
              contentStyle: { backgroundColor: theme.colors.bg.app },
            }}
          />
        </Stack>
      </View>
    </CallProvider>
    </NavigationThemeProvider>
  );
}
