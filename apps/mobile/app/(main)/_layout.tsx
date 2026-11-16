/**
 * Keep each main section mounted and let the navigator own the entire crossfade.
 */
import React from 'react';
import { Easing, StyleSheet, View } from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import Animated, { Easing as ReanimatedEasing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainHeader } from '../../src/components/MainHeader';
import { TopBar } from '../../src/components/TopBar';
import { useAuth } from '../../src/auth/AuthProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ThemeSurface } from '../../src/theme/ThemeSurface';
import { strings } from '@dologram/shared';

export default function MainLayout() {
  const { session } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const segments = useSegments() as readonly string[];
  const blockedChats = segments[1] === 'blocked';
  const insets = useSafeAreaInsets();
  const headerProgress = useSharedValue(blockedChats ? 1 : 0);

  React.useEffect(() => {
    headerProgress.value = withTiming(blockedChats ? 1 : 0, {
      duration: theme.reduceMotion ? 0 : 240,
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
    });
  }, [blockedChats, headerProgress, theme.reduceMotion]);

  const mainHeaderStyle = useAnimatedStyle(() => ({ opacity: 1 - headerProgress.value }));
  const blockedHeaderStyle = useAnimatedStyle(() => ({ opacity: headerProgress.value }));

  return (
    <ThemeSurface key={session?.user.id ?? 'signed-out'} style={{ flex: 1, backgroundColor: theme.colors.bg.app }}>
      <View style={[styles.headerSlot, { height: insets.top + 56 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, mainHeaderStyle]} pointerEvents={blockedChats ? 'none' : 'auto'}>
          <MainHeader />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, blockedHeaderStyle]} pointerEvents={blockedChats ? 'auto' : 'none'}>
          <TopBar title={strings.chatList.blockedChats} onBack={() => router.back()} />
        </Animated.View>
      </View>
      <View style={{ flex: 1 }}>
        <Tabs
          initialRouteName="(tabs)"
          backBehavior="initialRoute"
          tabBar={() => null}
          detachInactiveScreens={false}
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: theme.colors.bg.app },
            animation: theme.reduceMotion ? 'none' : 'fade',
            transitionSpec: {
              animation: 'timing',
              config: { duration: theme.reduceMotion ? 0 : 240, easing: Easing.out(Easing.cubic) },
            },
          }}
        >
          <Tabs.Screen name="(tabs)" />
          <Tabs.Screen name="archive" />
          <Tabs.Screen name="ignored" />
          <Tabs.Screen name="folders" />
          <Tabs.Screen name="blocked" />
        </Tabs>
      </View>
    </ThemeSurface>
  );
}

const styles = StyleSheet.create({
  headerSlot: { width: '100%' },
});
