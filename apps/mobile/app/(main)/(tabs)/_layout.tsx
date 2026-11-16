/**
 * Tabs layout without a visible bottom tab bar.
 * headerShown: false — TopBar is rendered by each screen.
 * Android back button: closes open sheet/dialog first; Settings returns to
 * Chats; chat list leaves the app. (11.2, 12.6, Phase 3 Step 3)
 *
 * Note: BottomSheet and Dialog components handle their own BackHandler.
 * This layout handles the remaining rules:
 *   - Settings tab: back → navigate to Chats (index)
 *   - Chats tab: back → exit app (BackHandler.exitApp)
 */
import React, { useCallback } from 'react';
import { BackHandler, Easing } from 'react-native';
import { Tabs, useFocusEffect, useRouter, useSegments } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';

export default function TabsLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { colors, reduceMotion } = useTheme();

  const handleBackPress = useCallback(() => {
    // Determine the current tab by looking at the last segment.
    const lastSegment = segments[segments.length - 1];

    if (lastSegment === 'settings') {
      // Settings → navigate back to Chats
      router.navigate('/(main)/(tabs)');
      return true;
    }

    if (lastSegment === 'index') {
      // Chats (root tab) → exit the app
      BackHandler.exitApp();
      return true;
    }

    // Let other handlers (BottomSheet, Dialog) handle it first
    return false;
  }, [segments, router]);

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => sub.remove();
  }, [handleBackPress]));

  return (
    <Tabs
      initialRouteName="index"
      tabBar={() => null}
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg.app },
        animation: reduceMotion ? 'none' : 'fade',
        transitionSpec: {
          animation: 'timing',
          config: { duration: reduceMotion ? 0 : 250, easing: Easing.out(Easing.cubic) },
        },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
