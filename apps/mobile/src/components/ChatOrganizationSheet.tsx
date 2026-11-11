import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { strings, type ChatListItem, type MuteOptionId } from '@dologram/shared';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';

export type OrganizationFolder = { folderId: string; name: string; containsChat: boolean };

type Props = {
  visible: boolean;
  item: ChatListItem | null;
  folders: readonly OrganizationFolder[];
  offline: boolean;
  busy: boolean;
  onClose: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onIgnore?: () => void;
  ignored?: boolean;
  onUnignore?: () => void;
  onAddMembers?: () => void;
  onMute: (option: MuteOptionId) => void;
  onUnmute: () => void;
  onMarkUnread?: () => void;
  onLeaveGroup?: () => void;
  onDelete?: () => void;
  onToggleFolder: (folderId: string, containsChat: boolean) => void;
};

type Mode = 'actions' | 'mute' | 'folders';

/** Messenger-style long-press conversation actions. */
export function ChatOrganizationSheet(props: Props) {
  return props.visible && props.item ? <SheetContent key={props.item.chatId} {...props} /> : null;
}

function SheetContent({
  visible,
  item,
  folders,
  offline,
  busy,
  onClose,
  onPin,
  onUnpin,
  onArchive,
  onUnarchive,
  onIgnore,
  ignored = false,
  onUnignore,
  onAddMembers,
  onMute,
  onUnmute,
  onMarkUnread,
  onLeaveGroup,
  onDelete,
  onToggleFolder,
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const [mode, setMode] = useState<Mode>('actions');

  const close = () => {
    setMode('actions');
    onClose();
  };

  if (item === null) return null;

  const actionRow = (
    iconName: string,
    label: string,
    onPress: (() => void) | undefined,
    options: { disabled?: boolean; destructive?: boolean; selected?: boolean } = {},
  ) => {
    if (!onPress) return null;
    const disabled = busy || (options.disabled ?? false);
    const color = options.destructive ? c.error.text : c.text.primary;
    return (
      <Pressable
        key={label}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed && !disabled ? c.bg.pressed : 'transparent',
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, selected: options.selected }}
      >
        <View style={styles.iconBox}>
          <Icon name={iconName} size="lg" color={color} />
        </View>
        <Text style={[textStyle(theme.typeTokens.bodyLg), { color, flex: 1 }]}>{label}</Text>
        {options.selected ? <Text style={{ color }}>✓</Text> : null}
      </Pressable>
    );
  };

  const networkDisabled = offline || busy;
  const group = item.isGroup && !item.savedMessages;
  const rows =
    mode === 'actions'
      ? [
          actionRow(
            item.pinned ? 'action.starOff' : 'action.star',
            item.pinned ? strings.organization.unstar : strings.organization.star,
            item.pinned ? onUnpin : onPin,
          ),
          actionRow(
            item.archived ? 'action.unarchive' : 'action.archive',
            item.archived ? strings.organization.unarchive : strings.organization.archive,
            item.archived ? onUnarchive : onArchive,
            { disabled: networkDisabled },
          ),
          actionRow('action.ignore', ignored ? strings.organization.unignore : strings.organization.ignore, ignored ? onUnignore : onIgnore),
          ...(group && item.canAddMembers
            ? [actionRow('action.addMembers', strings.organization.addMembers, onAddMembers, { disabled: networkDisabled })]
            : []),
          actionRow(
            item.muted ? 'action.unmute' : 'action.mute',
            item.muted ? strings.organization.unmute : strings.organization.mute,
            item.muted ? onUnmute : () => setMode('mute'),
            { disabled: networkDisabled },
          ),
          // Folder organization remains available from the existing DoloGram menu.
          actionRow('action.addToFolder', strings.organization.addToFolder, () => setMode('folders'), {
            disabled: networkDisabled,
          }),
          actionRow('action.markUnread', strings.organization.markUnread, onMarkUnread),
          ...(group
            ? [actionRow('action.signOut', strings.organization.leaveGroup, onLeaveGroup, {
                disabled: networkDisabled,
                destructive: true,
              })]
            : []),
          actionRow('action.delete', strings.organization.deleteConversation, onDelete, { destructive: true }),
        ]
      : mode === 'mute'
        ? [
            actionRow('action.mute', strings.organization.oneHour, () => onMute('oneHour'), { disabled: networkDisabled }),
            actionRow('action.mute', strings.organization.eightHours, () => onMute('eightHours'), { disabled: networkDisabled }),
            actionRow('action.mute', strings.organization.oneWeek, () => onMute('oneWeek'), { disabled: networkDisabled }),
            actionRow('action.mute', strings.organization.untilUnmuted, () => onMute('untilUnmuted'), { disabled: networkDisabled }),
          ]
        : folders.length > 0
          ? folders.map((folder) =>
              actionRow(
                'action.folder',
                folder.name,
                () => onToggleFolder(folder.folderId, folder.containsChat),
                { disabled: networkDisabled, selected: folder.containsChat },
              ),
            )
          : [actionRow('action.folder', strings.folders.noFolders, () => undefined, { disabled: true })];

  return (
    <BottomSheet visible={visible} onClose={close}>
      <View style={styles.content} accessibilityLabel={`${item.title} conversation actions`}>
        {mode !== 'actions' ? (
          <View style={styles.header}>
            <Pressable
              onPress={() => setMode('actions')}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.back}
            >
              <Icon name="nav.back" size="md" color={c.text.primary} />
            </Pressable>
            <Text style={[textStyle(theme.typeTokens.titleMd), { color: c.text.primary, flex: 1 }]}>
              {mode === 'mute' ? strings.organization.mute : strings.organization.addToFolder}
            </Text>
          </View>
        ) : null}
        {offline ? (
          <Text style={[textStyle(theme.typeTokens.bodySm), styles.offline, { color: c.text.secondary }]}>
            {strings.common.noConnection}
          </Text>
        ) : null}
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          {rows}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 12 },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  offline: { paddingHorizontal: 20, paddingBottom: 8 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20 },
  iconBox: { width: 28, alignItems: 'center' },
});
