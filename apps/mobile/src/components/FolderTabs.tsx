/**
 * CMP-14: folder tabs (AND-03, AND-13).
 *
 * A horizontally scrolling row: "All", then the user's folders in creation order.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { strings } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { IconButton } from './Button';

export interface FolderTabsFolder {
  folder_id: string;
  name: string;
}

export interface FolderTabsProps {
  folders: readonly FolderTabsFolder[];
  /** Selected folder id; null is "All". */
  activeId: string | null;
  onSelect: (folderId: string | null) => void;
  onOpenFolders?: () => void;
}

export function FolderTabs({ folders, activeId, onSelect, onOpenFolders }: FolderTabsProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View
      style={[styles.bar, { borderBottomColor: c.separator }]}
      accessibilityRole="tablist"
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <FolderTab
          label={strings.chatList.all}
          active={activeId === null}
          onPress={() => onSelect(null)}
        />
        {folders.map((folder) => (
          <FolderTab
            key={folder.folder_id}
            label={folder.name}
            active={activeId === folder.folder_id}
            onPress={() => onSelect(folder.folder_id)}
          />
        ))}
        {onOpenFolders ? (
          <IconButton
            iconName="action.folder"
            iconSize="md"
            accessibilityLabel={strings.chatList.folders}
            onPress={onOpenFolders}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function FolderTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <Pressable
      hitSlop={2}
      style={({ pressed }) => [
        styles.tab,
        active ? { backgroundColor: c.bg.surface } : null,
        pressed ? { backgroundColor: c.bg.pressed } : null,
      ]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[
          textStyle(theme.typeTokens.labelMd),
          styles.tabLabel,
          { color: active ? c.text.primary : c.text.secondary },
        ]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.5}
      >
        {label}
      </Text>
      {active ? <View style={[styles.indicator, { backgroundColor: c.brand.primary }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 44,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'center',
  },
  tab: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 18,
    maxWidth: 160,
  },
  tabLabel: {
    maxWidth: 128,
  },
  indicator: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 2,
    height: 4,
    borderRadius: 2,
  },
});
