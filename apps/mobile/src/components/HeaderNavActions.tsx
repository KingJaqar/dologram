/** Shared navigation actions used by the main DoloGram header. */
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { BottomSheet } from './BottomSheet';
import { NewSheetContent } from './TabBar';
import { useAuth } from '../auth/AuthProvider';
import { AccountSwitcherPopover } from './AccountSwitcherPopover';
import { HeaderTab } from './HeaderTab';

export interface HeaderNavActionsProps {
  onChatsPress?: () => void;
  onArchivePress?: () => void;
  onIgnoredPress?: () => void;
  archiveCount?: number;
  onProfilePress?: () => void;
  activeSection?: 'chats' | 'archive' | 'ignored' | 'folders' | 'settings';
  showChats?: boolean;
  showArchive?: boolean;
  showIgnored?: boolean;
  showNew?: boolean;
  showProfile?: boolean;
  showActiveLabel?: boolean;
}

export function HeaderNavActions({
  onChatsPress,
  onArchivePress,
  onIgnoredPress,
  archiveCount = 0,
  onProfilePress,
  activeSection,
  showChats = true,
  showArchive = false,
  showIgnored = false,
  showNew = true,
  showProfile = true,
  showActiveLabel = true,
}: HeaderNavActionsProps) {
  const theme = useTheme();
  const c = theme.colors;
  const { profile, session } = useAuth();
  const [newSheetVisible, setNewSheetVisible] = useState(false);
  const [accountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const suppressProfilePress = useRef(0);

  return (
    <View style={styles.actions}>
      {showChats ? (
        <HeaderTab
          label="Chats"
          active={activeSection === 'chats'}
          onPress={onChatsPress}
          accessibilityLabel="Chats"
          icon={<Icon name="nav.chats" size="md" color={activeSection === 'chats' ? c.brand.primary : c.text.primary} />}
        />
      ) : null}

      {showArchive ? (
        <HeaderTab
          label="Archive"
          showLabel={showActiveLabel}
          active={activeSection === 'archive'}
          onPress={onArchivePress}
          accessibilityLabel={archiveCount > 0 ? `Archive, ${archiveCount} unread` : 'Archive'}
          labelWidth={48}
          icon={(
            <View style={styles.badgedIcon}>
              <Icon
              name="nav.archive"
              size="md"
              color={activeSection === 'archive' ? c.brand.primary : c.text.primary}
              />
              {archiveCount > 0 ? (
                <View style={styles.badge}>
                  <Badge count={archiveCount} />
                </View>
              ) : null}
            </View>
          )}
        />
      ) : null}

      {showIgnored ? (
        <HeaderTab
          label="Ignored"
          showLabel={showActiveLabel}
          active={activeSection === 'ignored'}
          onPress={onIgnoredPress}
          accessibilityLabel="Ignored chats"
          labelWidth={44}
          icon={<Icon name="action.ignore" size="md" color={activeSection === 'ignored' ? c.brand.primary : c.text.primary} />}
        />
      ) : null}

      {showNew ? (
        <Pressable
          style={({ pressed }) => [styles.action, pressed && { backgroundColor: c.bg.pressed }]}
          onPress={() => setNewSheetVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="New"
        >
          <Icon name="nav.new" size="md" color={c.text.primary} />
        </Pressable>
      ) : null}

      {showProfile ? (
        <HeaderTab
          label="Profile"
          showLabel={showActiveLabel}
          active={activeSection === 'settings'}
          onPress={() => {
            if (Date.now() - suppressProfilePress.current < 700) {
              suppressProfilePress.current = 0;
              return;
            }
            onProfilePress?.();
          }}
          onLongPress={() => {
            suppressProfilePress.current = Date.now();
            setAccountSwitcherVisible(true);
          }}
          delayLongPress={450}
          accessibilityLabel="Profile. Long press to switch accounts"
          accessibilityHint="Long press to show other signed-in accounts"
          accessibilityRole="button"
          labelWidth={48}
          icon={(
            <View
              style={[
                styles.profileIndicator,
                { borderColor: activeSection === 'settings' ? c.brand.primary : 'transparent' },
              ]}
            >
              <Avatar
                id={profile?.user_id ?? session?.user.id ?? 'unknown'}
                displayName={profile?.display_name ?? ''}
                imageUrl={profile?.avatar_url}
                size={24}
              />
            </View>
          )}
        />
      ) : null}

      <AccountSwitcherPopover
        visible={accountSwitcherVisible}
        onClose={() => setAccountSwitcherVisible(false)}
      />

      <BottomSheet visible={newSheetVisible} onClose={() => setNewSheetVisible(false)}>
        <NewSheetContent onClose={() => setNewSheetVisible(false)} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  action: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  badgedIcon: {
    position: 'relative',
  },
  profileIndicator: {
    borderRadius: 15,
    borderWidth: 2,
    padding: 1,
  },
  badge: {
    position: 'absolute',
    top: -9,
    right: -14,
  },
});
