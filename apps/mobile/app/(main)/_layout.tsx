/**
 * Keep each main section mounted and let the navigator own the entire crossfade.
 */
import React from 'react';
import { Easing, View } from 'react-native';
import { Tabs } from 'expo-router';
import { MainHeader } from '../../src/components/MainHeader';
import { useAuth } from '../../src/auth/AuthProvider';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function MainLayout() {
  const { session } = useAuth();
  const theme = useTheme();
  return (
    <View key={session?.user.id ?? 'signed-out'} style={{ flex: 1, backgroundColor: theme.colors.bg.app }}>
      <MainHeader />
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
              config: { duration: theme.reduceMotion ? 0 : 250, easing: Easing.out(Easing.cubic) },
            },
          }}
        >
          <Tabs.Screen name="(tabs)" />
          <Tabs.Screen name="archive" />
          <Tabs.Screen name="ignored" />
          <Tabs.Screen name="folders" />
        </Tabs>
      </View>
    </View>
  );
}
