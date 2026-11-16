import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { strings, type ChatListItem, type MuteOptionId } from '@dologram/shared';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { MuteOptionGrid } from './MuteOptionGrid';
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
  blocked?: boolean;
  onUnblock?: () => void;
  onAddMembers?: () => void;
  onMute: (option: MuteOptionId) => void;
  onUnmute: () => void;
  onMarkUnread?: () => void;
  onLeaveGroup?: () => void;
  onDelete?: () => void;
  onToggleFolder: (folderId: string, containsChat: boolean) => void;
  /** Called after the sheet has fully slid down and unmounted. */
  onExited?: () => void;
};

type Mode = 'actions' | 'mute' | 'folders';

/** Messenger-style long-press conversation actions. */
export function ChatOrganizationSheet(props: Props) {
  // The parent clears its selection immediately after an action. Keep the last
  // item rendered until BottomSheet finishes its native-driven exit transition.
  const [retainedItem, setRetainedItem] = useState<ChatListItem | null>(props.item);

  useEffect(() => {
    if (props.item) {
      // This state mirrors the latest selection solely to keep the exit view
      // mounted after the parent clears its selection.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRetainedItem(props.item);
    }
  }, [props.item]);

  const displayItem = props.item ?? retainedItem;
  if (!displayItem) return null;

  return (
    <SheetContent
      key={displayItem.chatId}
      {...props}
      item={displayItem}
      visible={props.visible && props.item !== null}
      onExited={() => {
        if (props.item === null) setRetainedItem(null);
        // Deferred actions (navigate, or open a dialog) must wait for the exit
        // transition, otherwise the newly presented UI interrupts it.
        props.onExited?.();
      }}
    />
  );
}

type SheetContentProps = Props;

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
  blocked = false,
  onUnblock,
  onAddMembers,
  onMute,
  onUnmute,
  onMarkUnread,
  onLeaveGroup,
  onDelete,
  onToggleFolder,
  onExited,
}: SheetContentProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [mode, setMode] = useState<Mode>('actions');
  const wasVisibleRef = useRef(false);

  // Reset the submenu on open, not on close: swapping the rows while the sheet
  // slides down changes its measured height and makes the exit jump.
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setMode('actions');
    }
    wasVisibleRef.current = visible;
  }, [visible]);

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
        {options.selected ? (
          <View
            testID="selected-folder-indicator"
            style={[styles.selectedIndicator, { backgroundColor: c.connection.stable }]}
          />
        ) : null}
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
          actionRow(
            'action.ignore',
            blocked ? strings.organization.unblock : ignored ? strings.organization.unignore : strings.organization.ignore,
            blocked ? onUnblock : ignored ? onUnignore : onIgnore,
          ),
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
      : folders.length > 0
          ? folders.map((folder) =>
              actionRow(
                folder.containsChat ? 'action.removeFromFolder' : 'action.addToFolder',
                folder.name,
                () => onToggleFolder(folder.folderId, folder.containsChat),
                { disabled: networkDisabled, selected: folder.containsChat },
              ),
            )
          : [actionRow('action.folder', strings.folders.noFolders, () => undefined, { disabled: true })];

  return (
    <BottomSheet visible={visible} onClose={onClose} onExited={onExited}>
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
        {mode === 'mute' ? (
          <MuteOptionGrid disabled={networkDisabled} onSelect={onMute} />
        ) : (
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {rows}
          </ScrollView>
        )}
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
  selectedIndicator: { width: 16, height: 16, borderRadius: 8 },
});
