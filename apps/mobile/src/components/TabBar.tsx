/**
 * CMP-32: Custom bottom tab bar.
 * Three tabs: Chats, New (never active, opens the New sheet), Profile.
 * Height 56 + navigation inset.
 * A tap on the active Chats tab scrolls the list to top (via callback).
 * 12.5, CMP-32, D-95, D-142
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { BottomSheet } from './BottomSheet';
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
  const [newSheetVisible, setNewSheetVisible] = useState(false);

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

        {/* New tab — never active, opens the sheet */}
        <Pressable
          style={styles.tab}
          onPress={() => setNewSheetVisible(true)}
          accessibilityRole="tab"
          accessibilityLabel="New"
          accessibilityState={{ selected: false }}
        >
          <Icon
            name="nav.new"
            size="md"
            color={c.tab.inactive}
          />
        </Pressable>

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

      {/* New sheet */}
      <BottomSheet
        visible={newSheetVisible}
        onClose={() => setNewSheetVisible(false)}
      >
        <NewSheetContent onClose={() => setNewSheetVisible(false)} />
      </BottomSheet>
    </>
  );
}

export function NewSheetContent({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();

  const navigate = (path: string) => {
    onClose();
    setTimeout(() => router.push(path), 50);
  };

  return (
    <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[6], gap: 4 }}>
      <Pressable
        style={({ pressed }) => [
          styles.sheetRow,
          {
            backgroundColor: pressed ? c.bg.pressed : 'transparent',
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.space[4],
            paddingVertical: theme.space[4],
          },
        ]}
        onPress={() => navigate('/new-chat')}
        accessibilityRole="button"
        accessibilityLabel="New chat"
      >
        <Icon name="action.newChat" size="md" color={c.text.primary} />
        <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]}>
          New chat
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.sheetRow,
          {
            backgroundColor: pressed ? c.bg.pressed : 'transparent',
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.space[4],
            paddingVertical: theme.space[4],
          },
        ]}
        onPress={() => navigate('/new-group')}
        accessibilityRole="button"
        accessibilityLabel="New group"
      >
        <Icon name="action.newGroup" size="md" color={c.text.primary} />
        <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]}>
          New group
        </Text>
      </Pressable>
    </View>
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
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});
