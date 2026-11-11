/** Shared main navigation header used by Chats, Folders, Archive, and Settings. */
import React, { useRef } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { TopBar } from './TopBar';
import { HeaderNavActions } from './HeaderNavActions';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { HeaderTab } from './HeaderTab';

export interface DoloGramHeaderProps {
  onChatsPress: () => void;
  onFoldersPress?: () => void;
  onArchivePress?: () => void;
  onIgnoredPress?: () => void;
  onSearchPress?: (originX: number) => void;
  /** Render the archive action even when the current screen is already Archive. */
  showArchive?: boolean;
  archivedCount?: number;
  onProfilePress: () => void;
  activeSection?: 'chats' | 'archive' | 'ignored' | 'folders' | 'settings';
  right?: React.ReactNode;
  below?: React.ReactNode;
}

export function DoloGramHeader({
  onChatsPress,
  onFoldersPress,
  onArchivePress,
  onIgnoredPress,
  onSearchPress,
  showArchive,
  archivedCount = 0,
  onProfilePress,
  activeSection = 'chats',
  right,
  below,
}: DoloGramHeaderProps) {
  const theme = useTheme();
  const c = theme.colors;
  const { width } = useWindowDimensions();
  const searchButton = useRef<View>(null);
  const showActiveLabel = !onSearchPress || width >= (activeSection === 'chats' ? 354 : 362);

  return (
    <>
      <TopBar
        leftWide
        horizontalPadding={onSearchPress && width < 380 ? 0 : 4}
        left={
          <View style={styles.headerLeading}>
            <HeaderTab
              label="Chats"
              active={activeSection === 'chats'}
              onPress={onChatsPress}
              accessibilityLabel="Chats"
              closedWidth={onSearchPress ? 44 : 48}
              showLabel={showActiveLabel}
              labelWidth={40}
              iconWidth={40}
              icon={(
                <Image
                  source={require('../../assets/logo/dologram_logo.png')}
                  style={styles.logo}
                  accessible={false}
                />
              )}
            />
            {onFoldersPress ? (
              <HeaderTab
                label="Folders"
                active={activeSection === 'folders'}
                onPress={onFoldersPress}
                accessibilityLabel="Folders"
                showLabel={showActiveLabel}
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
              showChats={false}
              showArchive={showArchive ?? onArchivePress !== undefined}
              archiveCount={archivedCount}
              activeSection={activeSection}
              showNew={false}
              showProfile={false}
              onArchivePress={onArchivePress}
              onIgnoredPress={onIgnoredPress}
              showIgnored={onIgnoredPress !== undefined}
              showActiveLabel={showActiveLabel}
            />
            {onSearchPress ? (
              <Pressable
                ref={searchButton}
                accessibilityRole="button"
                accessibilityLabel="Search chats and messages"
                style={({ pressed }) => [styles.search, pressed && { backgroundColor: c.bg.pressed }]}
                onPress={() => searchButton.current?.measureInWindow((x, _y, buttonWidth) => onSearchPress(x + buttonWidth / 2))}
              >
                <Icon name="action.search" size="md" color={c.text.primary} />
              </Pressable>
            ) : null}
          </View>
        }
        right={
          <View style={styles.headerRight}>
            <HeaderNavActions
              showChats={false}
              activeSection={activeSection}
              showNew
              showProfile
              showActiveLabel={showActiveLabel}
              onProfilePress={onProfilePress}
            />
            {right}
          </View>
        }
      />
      {below ? (
        <View
          style={[
            styles.below,
            { backgroundColor: c.bg.chatList, borderBottomColor: c.separator },
          ]}
        >
          {below}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  headerLeading: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  search: { width: 44, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  below: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logo: { width: 40, height: 40 },
});
