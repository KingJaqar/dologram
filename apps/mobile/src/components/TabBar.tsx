/**
 * CMP-32: Custom bottom tab bar.
 * Main navigation tabs for Chats and Profile.
 * Height 56 + navigation inset.
 * A tap on the active Chats tab scrolls the list to top (via callback).
 * 12.5, CMP-32, D-95, D-142
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { useAuth } from '../auth/AuthProvider';

const TAB_BAR_HEIGHT = 56;

interface TabButtonProps {
  iconName: string;
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: number;
}

function TabButton({ iconName, label, active, onPress, badge }: TabButtonProps) {
  const theme = useTheme();
  const c = theme.colors;
  const iconColor = active ? c.tab.active : c.tab.inactive;

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Icon name={iconName} size="md" color={iconColor} />
    </Pressable>
  );
}

export interface TabBarExternalCallbacks {
  /** Called when the user taps the Chats tab while it is already active. */
  onChatsTabReselect?: () => void;
}

// Module-level ref store for the scroll-to-top callback
let _onChatsTabReselect: (() => void) | null = null;
export function setChatsTabReselectHandler(fn: (() => void) | null) {
  _onChatsTabReselect = fn;
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();

  const handleChatsPress = useCallback(() => {
    const chatsRoute = state.routes.find((r: { name: string }) => r.name === 'index');
    if (!chatsRoute) return;
    const isActive = state.routes[state.index]?.name === 'index';
    if (isActive) {
      _onChatsTabReselect?.();
    } else {
      navigation.navigate(chatsRoute.name);
    }
  }, [state, navigation]);

  const handleSettingsPress = useCallback(() => {
    const settingsRoute = state.routes.find((r: { name: string }) => r.name === 'settings');
    if (!settingsRoute) return;
    navigation.navigate(settingsRoute.name);
  }, [state, navigation]);

  const activeRouteName = state.routes[state.index]?.name ?? '';
  const isChatsActive = activeRouteName === 'index';
  const isSettingsActive = activeRouteName === 'settings';

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            height: TAB_BAR_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom,
            backgroundColor: c.bg.chatList,
            borderTopColor: c.separator,
          },
        ]}
        accessibilityRole="tablist"
      >
        {/* Chats tab */}
        <TabButton
          iconName="nav.chats"
          label="Chats"
          active={isChatsActive}
          onPress={handleChatsPress}
        />

        {/* Profile / Settings tab */}
        <Pressable
          style={styles.tab}
          onPress={handleSettingsPress}
          accessibilityRole="tab"
          accessibilityLabel="Profile and settings"
          accessibilityState={{ selected: isSettingsActive }}
        >
          <View
            style={[
              styles.profileIndicator,
              { borderColor: isSettingsActive ? c.tab.active : 'transparent' },
            ]}
          >
            <Avatar
              id={profile?.user_id ?? session?.user.id ?? 'unknown'}
              displayName={profile?.display_name ?? ''}
              imageUrl={profile?.avatar_url}
              size={24}
            />
          </View>
        </Pressable>
      </View>

    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIndicator: {
    borderRadius: 15,
    borderWidth: 2,
    padding: 1,
  },
});
