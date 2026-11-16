/**
 * Root layout — sets up gesture handling and the app's providers.
 * Loads Inter and JetBrains Mono fonts and holds the splash screen until fonts and the
 * stored session are ready. Phase 4 Step 3 adds the auth guard (M2-04, D-78).
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { Stack } from 'expo-router/js-stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
  isCallInviteNotificationContent,
  isCallNotificationContent,
  isMemoReminderData,
  startPushNotifications,
  subscribeNotificationResponses,
} from '../src/notifications/pushNotifications';
import { acknowledgeMemoReminder, memoReminderRoute, startMemoReminderCoordinator } from '../src/memos/reminders';
import { startMemoSync } from '../src/memos/sync';
import { validateCallNotification } from '../src/calls/notificationValidation';
import { searchCrossfade } from '../src/search/transition';
import { MemoProvider, useMemoAccess } from '../src/memos/MemoProvider';
import { AppSplashScreen } from '../src/components/AppSplashScreen';

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <MemoProvider>
                <RootNavigator fontsReady={fontsReady} />
              </MemoProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { status, session } = useAuth();
  const { scope: memoAccess } = useMemoAccess();
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
    if (!currentUserId) return;
    const worker = startQueueWorker(currentUserId);
    const sync = startSync(currentUserId);
    return () => {
      sync.stop();
      worker.stop();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) return startPushNotifications(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    if (!memoAccess) return;
    return startMemoReminderCoordinator(memoAccess);
  }, [memoAccess]);

  useEffect(() => {
    if (!memoAccess || memoAccess.offline) return;
    return startMemoSync(memoAccess);
  }, [memoAccess]);

  useEffect(() => {
    const notificationAccountId = currentUserId ?? memoAccess?.accountId;
    if (!notificationAccountId || !fontsReady) return;
    return subscribeNotificationResponses((response) => {
      const { content, identifier } = response.notification.request;
      const data = content.data;
      if (isMemoReminderData(data)) {
        if (data.account_id !== notificationAccountId || handledNotificationRef.current === identifier) return;
        handledNotificationRef.current = identifier;
        clearNotificationResponse();
        if (memoAccess) {
          void acknowledgeMemoReminder(memoAccess, data.reminder_id, data.occurrence_id).catch(() => undefined);
          router.push(memoReminderRoute(data));
        }
        return;
      }
      const callNotification = isCallNotificationContent({ data });
      const callInvite = isCallInviteNotificationContent({ data });
      const callId = callInvite && data && typeof data === 'object' && 'call_id' in data && typeof data.call_id === 'string'
        ? data.call_id
        : null;
      const recipientId = data && typeof data === 'object' && 'recipient_id' in data && typeof data.recipient_id === 'string'
        ? data.recipient_id
        : null;
      const chatId = data && typeof data === 'object' && 'chat_id' in data && typeof data.chat_id === 'string'
        ? data.chat_id
        : null;
      if ((!chatId && !callId) || handledNotificationRef.current === identifier) return;
      handledNotificationRef.current = identifier;
      clearNotificationResponse();
      if (callId) {
        if (!currentUserId || recipientId !== currentUserId) return;
        void validateCallNotification(callId, currentUserId).then((valid) => {
          if (valid) router.push({ pathname: '/call/[callId]', params: { callId } });
        });
      } else if (callNotification) {
        return;
      } else if (chatId) {
        router.push({ pathname: '/chat/[chatId]', params: { chatId } });
      }
    });
  }, [currentUserId, fontsReady, memoAccess, router]);

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
      root === 'local-memos' ||
      root === 'manage-accounts' ||
      root === 'handle-share' ||
      root === 'memo-reminder';
    const onChangePassword = root === 'change-password';
    const signedInOnlyRoute =
      root === 'sign-in' || root === 'sign-up' || root === 'forgot-password';

    if (status === 'signedOut') {
      if (root === 'memo' && memoAccess?.offline) return;
      if (!signedOutRoute) router.replace('/sign-in');
      return;
    }

    if (status === 'mustChangePassword') {
      if (!onChangePassword) router.replace('/change-password');
      return;
    }

    if ((signedInOnlyRoute && addAccount !== '1') || root === 'local-memos') router.replace('/(main)/(tabs)');
  }, [status, segments, router, addAccount, memoAccess]);

  if (!fontsReady || status === 'loading') {
    return <AppSplashScreen />;
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
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          initialRouteName="(main)"
          screenOptions={({ route }) => {
            const isChat = route.name === 'chat/[chatId]';
            const isCall = route.name === 'call/[callId]';
            const isModal = route.name === 'forward' || route.name === 'handle-share';
            const usesStandardFade = !isCall && !isModal;
            return {
              headerShown: false,
              cardStyle: { backgroundColor: isChat ? theme.colors.bg.chat : theme.colors.bg.app },
              animation: isCall ? 'slide_from_bottom' : usesStandardFade ? 'fade' : undefined,
              ...(usesStandardFade && !theme.reduceMotion && searchCrossfade),
              ...(theme.reduceMotion && { animation: 'none' }),
            };
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
        <Stack.Screen name="chat/[chatId]" options={{ freezeOnBlur: true }} />
        <Stack.Screen name="call/[callId]" options={{ presentation: 'modal', freezeOnBlur: false }} />
        <Stack.Screen name="handle-share" options={{ presentation: 'modal' }} />
        </Stack>
      </View>
    </CallProvider>
    </NavigationThemeProvider>
  );
}
