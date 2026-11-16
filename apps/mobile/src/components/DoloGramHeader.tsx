/** Shared main navigation header used by Chats, Folders, Archive, and Settings. */
import React, { useRef } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { TopBar } from './TopBar';
import { HeaderNavActions } from './HeaderNavActions';
import { useTheme } from '../theme/ThemeProvider';
import { ThemeSurface } from '../theme/ThemeSurface';
import { Icon } from './Icon';
import { Badge } from './Badge';
import type { ConnectionStatus } from '../net/connectionStatus';
import {
  COMPACT_ACTIVE_TAB_WIDTH,
  HEADER_CONTROL_WIDTH,
  HeaderTab,
  useHeaderSelection,
  WIDE_ACTIVE_TAB_WIDTH,
  type HeaderSection,
} from './HeaderTab';

export interface DoloGramHeaderProps {
  connectionStatus?: ConnectionStatus;
  onChatsPress: () => void;
  onFoldersPress?: () => void;
  onArchivePress?: () => void;
  onIgnoredPress?: () => void;
  onSearchPress?: (originX: number) => void;
  /** Render the archive action even when the current screen is already Archive. */
  showArchive?: boolean;
  archivedCount?: number;
  ignoredCount?: number;
  chatsCount?: number;
  onProfilePress: () => void;
  activeSection?: HeaderSection;
  right?: React.ReactNode;
  below?: React.ReactNode;
}

export function DoloGramHeader({
  connectionStatus,
  onChatsPress,
  onFoldersPress,
  onArchivePress,
  onIgnoredPress,
  onSearchPress,
  showArchive,
  archivedCount = 0,
  ignoredCount = 0,
  chatsCount = 0,
  onProfilePress,
  activeSection = 'chats',
  right,
  below,
}: DoloGramHeaderProps) {
  const theme = useTheme();
  const c = theme.colors;
  const selection = useHeaderSelection(activeSection, theme.reduceMotion);
  const { width } = useWindowDimensions();
  const searchButton = useRef<View>(null);
  const archiveVisible = showArchive ?? onArchivePress !== undefined;
  const horizontalPadding = width < 380 ? 0 : 4;
  const availableWidth = width - 2 * horizontalPadding;
  // Chats and Profile are always present. Reserve space for one active tab.
  const inactiveCount = 1 + Number(!!onFoldersPress) + Number(archiveVisible)
    + Number(!!onIgnoredPress) + Number(!!onSearchPress);
  const compact = availableWidth < inactiveCount * HEADER_CONTROL_WIDTH + WIDE_ACTIVE_TAB_WIDTH;
  const controlWidth = Math.max(
    0,
    Math.min(HEADER_CONTROL_WIDTH, Math.floor((availableWidth - COMPACT_ACTIVE_TAB_WIDTH) / inactiveCount)),
  );

  return (
    <>
      <TopBar
        leftWide
        horizontalPadding={horizontalPadding}
        left={
          <View style={styles.headerLeading}>
            <HeaderTab
              label="Chats"
              section="chats"
              selection={selection}
              active={activeSection === 'chats'}
              onPress={onChatsPress}
              accessibilityLabel={chatsCount > 0 ? `Chats, ${chatsCount} unread` : 'Chats'}
              closedWidth={controlWidth}
              compact={compact}
              iconWidth={40}
              compactIconScale={0.625}
              icon={(
                <View style={styles.badgedIcon}>
                  <Image
                    source={require('../../assets/logo/dologram_logo.png')}
                    style={styles.logo}
                    accessible={false}
                  />
                  {chatsCount > 0 ? (
                    <View style={styles.badge}>
                      <Badge count={chatsCount} />
                    </View>
                  ) : null}
                </View>
              )}
            />
            {onFoldersPress ? (
              <HeaderTab
                label="Folders"
                section="folders"
                selection={selection}
                active={activeSection === 'folders'}
                onPress={onFoldersPress}
                accessibilityLabel="Folders"
                closedWidth={controlWidth}
                compact={compact}
                icon={(
                  <Icon
                    name="nav.folder"
                    size="md"
                    color={activeSection === 'folders' ? c.brand.primary : c.text.primary}
                  />
                )}
              />
            ) : null}
            <HeaderNavActions
              selection={selection}
              showArchive={archiveVisible}
              archiveCount={archivedCount}
              ignoredCount={ignoredCount}
              activeSection={activeSection}
              showProfile={false}
              onArchivePress={onArchivePress}
              onIgnoredPress={onIgnoredPress}
              showIgnored={onIgnoredPress !== undefined}
              controlWidth={controlWidth}
              compact={compact}
            />
          </View>
        }
        right={
          <View style={styles.headerRight}>
            {onSearchPress ? (
              <Pressable
                ref={searchButton}
                accessibilityRole="button"
                accessibilityLabel="Search chats and messages"
                style={({ pressed }) => [styles.search, { width: controlWidth }, pressed && { backgroundColor: c.bg.pressed }]}
                onPress={() => searchButton.current?.measureInWindow((x, _y, buttonWidth) => onSearchPress(x + buttonWidth / 2))}
              >
                <Icon name="action.search" size="md" color={c.text.primary} />
              </Pressable>
            ) : null}
            <HeaderNavActions
              selection={selection}
              activeSection={activeSection}
              connectionStatus={connectionStatus}
              showProfile
              controlWidth={controlWidth}
              compact={compact}
              onProfilePress={onProfilePress}
            />
            {right}
          </View>
        }
      />
      {below ? (
        <ThemeSurface
          style={[
            styles.below,
            { backgroundColor: c.bg.chatList, borderBottomColor: c.separator },
          ]}
        >
          {below}
        </ThemeSurface>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  headerLeading: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  search: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  below: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logo: { width: 40, height: 40 },
  badgedIcon: { position: 'relative' },
  badge: { position: 'absolute', top: -9, right: -14 },
});
