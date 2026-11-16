/** Shared navigation actions used by the main DoloGram header. */
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { useAuth } from '../auth/AuthProvider';
import { AccountSwitcherPopover } from './AccountSwitcherPopover';
import { HEADER_CONTROL_WIDTH, HeaderTab, type HeaderSection } from './HeaderTab';
import { CONNECTION_INDICATORS, type ConnectionStatus } from '../net/connectionStatus';
import { ProfileConnectionStroke } from './ProfileConnectionStroke';

export interface HeaderNavActionsProps {
  connectionStatus?: ConnectionStatus;
  selection: SharedValue<number[]>;
  onArchivePress?: () => void;
  onIgnoredPress?: () => void;
  archiveCount?: number;
  ignoredCount?: number;
  onProfilePress?: () => void;
  activeSection?: HeaderSection;
  showArchive?: boolean;
  showIgnored?: boolean;
  showProfile?: boolean;
  controlWidth?: number;
  compact?: boolean;
}

export function HeaderNavActions({
  connectionStatus = 'unstable',
  selection,
  onArchivePress,
  onIgnoredPress,
  archiveCount = 0,
  ignoredCount = 0,
  onProfilePress,
  activeSection,
  showArchive = false,
  showIgnored = false,
  showProfile = true,
  controlWidth = HEADER_CONTROL_WIDTH,
  compact = false,
}: HeaderNavActionsProps) {
  const theme = useTheme();
  const c = theme.colors;
  const connection = CONNECTION_INDICATORS[connectionStatus];
  const { profile, session } = useAuth();
  const [accountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const suppressProfilePress = useRef(0);

  return (
    <View style={styles.actions}>
      {showArchive ? (
        <HeaderTab
          label="Archive"
          section="archive"
          selection={selection}
          closedWidth={controlWidth}
          compact={compact}
          active={activeSection === 'archive'}
          onPress={onArchivePress}
          accessibilityLabel={archiveCount > 0 ? `Archive, ${archiveCount} unread` : 'Archive'}
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
          section="ignored"
          selection={selection}
          closedWidth={controlWidth}
          compact={compact}
          active={activeSection === 'ignored'}
          onPress={onIgnoredPress}
          accessibilityLabel={ignoredCount > 0 ? `Ignored chats, ${ignoredCount} unread` : 'Ignored chats'}
          icon={(
            <View style={styles.badgedIcon}>
              <Icon name="action.ignore" size="md" color={activeSection === 'ignored' ? c.brand.primary : c.text.primary} />
              {ignoredCount > 0 ? (
                <View style={styles.badge}>
                  <Badge count={ignoredCount} />
                </View>
              ) : null}
            </View>
          )}
        />
      ) : null}

      {showProfile ? (
        <HeaderTab
          label="Profile"
          section="settings"
          selection={selection}
          closedWidth={controlWidth}
          compact={compact}
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
          accessibilityLabel={`Profile. ${connection.label}. Long press to switch accounts`}
          accessibilityHint="Long press to show other signed-in accounts"
          iconWidth={30}
          icon={(
            <ProfileConnectionStroke color={c.connection[connectionStatus]}>
              <Avatar
                id={profile?.user_id ?? session?.user.id ?? 'unknown'}
                displayName={profile?.display_name ?? ''}
                imageUrl={profile?.avatar_url}
                size={24}
              />
            </ProfileConnectionStroke>
          )}
        />
      ) : null}

      <AccountSwitcherPopover
        visible={accountSwitcherVisible}
        onClose={() => setAccountSwitcherVisible(false)}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgedIcon: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -9,
    right: -14,
  },
});
