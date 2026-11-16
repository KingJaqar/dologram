import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  config,
  conversationIdentity,
  strings,
  validateFolderName,
  type ChatListItem,
  type ClassifiedError,
} from '@dologram/shared';
import { useTheme } from '../../src/theme/ThemeProvider';
import { textStyle } from '../../src/theme/typography';
import { Icon } from '../../src/components/Icon';
import { IconButton, Button } from '../../src/components/Button';
import { FolderTabs } from '../../src/components/FolderTabs';
import { FilterTabs } from '../../src/components/FilterTabs';
import { TextField } from '../../src/components/TextField';
import { EmptyState, ErrorState } from '../../src/components/EmptyState';
import { Dialog } from '../../src/components/Dialog';
import { BottomSheet } from '../../src/components/BottomSheet';
import { useToast } from '../../src/components/Toast';
import { useNetState } from '../../src/net/netState';
import { useFolders } from '../../src/folders/useFolders';
import { useChatList } from '../../src/chatList/useChatList';
import { mutationErrorMessage } from '../../src/chats/errors';
import { useDelayedFlag } from '../../src/hooks/useDelayedFlag';
import { FolderListTransition } from '../../src/chatList/FolderListTransition';
import { FolderScreenTransition } from '../../src/chatList/FolderScreenTransition';
import { ChatOrganizationActions } from '../../src/chatList/ChatOrganizationActions';
import { ChatListModeHeader, ChatSelectionToolbar, ChatSwipeableRow, useChatSwipeMutations, type ChatSelectionPhase, type ChatSwipeActionKey } from '../../src/chatList/ChatSwipeActions';
import { FloatingActionButton } from '../../src/components/FloatingActionButton';

type NameDialogProps = {
  visible: boolean;
  initialName: string;
  editing: boolean;
  busy: boolean;
  isNameTaken: (name: string) => boolean;
  onDismiss: () => void;
  onSave: (name: string) => void;
};

type FolderSection = 'chat' | 'manage';

function FolderNameDialog({ visible, initialName, editing, busy, isNameTaken, onDismiss, onSave }: NameDialogProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [name, setName] = useState(initialName);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const trimmed = name.trim();
  const valid = validateFolderName(name);
  const duplicate = isNameTaken(trimmed);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, ({ endCoordinates }) => {
      setKeyboardHeight(endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [visible]);

  const save = () => {
    if (valid && !duplicate && !busy) onSave(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} accessibilityViewIsModal>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior="padding"
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={0}
      >
        <Pressable style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: c.scrim }]} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Cancel" />
        <View
          style={[
            styles.dialogCenter,
            Platform.OS === 'android' && keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined,
          ]}
          pointerEvents="box-none"
        >
          <View style={[styles.dialogCard, { backgroundColor: c.bg.elevated, borderRadius: theme.radius.xl }]}>
            <Text style={[textStyle(theme.typeTokens.titleMd), { color: c.text.primary }]}>
              {editing ? strings.folders.rename : strings.folders.newFolder}
            </Text>
            <View style={{ marginTop: theme.space[4] }}>
              <TextField
                label={strings.folders.nameLabel}
                helper={strings.folders.nameHelper}
                error={name.length > 0 && !valid ? strings.folders.nameInvalid : duplicate ? strings.folders.nameTaken : undefined}
                value={name}
                onChangeText={setName}
                autoFocus
                maxLength={config.folders.nameMaxChars}
                charCount={trimmed.length}
                accessibilityLabel={strings.folders.nameLabel}
                returnKeyType="done"
                onSubmitEditing={save}
                style={{ color: c.text.primary }}
                selectionColor={c.brand.primary}
                cursorColor={c.brand.primary}
              />
            </View>
            <View style={styles.dialogActions}>
              <Button label="Cancel" variant="text" onPress={onDismiss} />
              <Button label="Save" onPress={save} disabled={!valid || duplicate || busy} loading={busy} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FolderMenu({
  visible,
  offline,
  onClose,
  onRename,
  onEdit,
  onDelete,
}: {
  visible: boolean;
  offline: boolean;
  onClose: () => void;
  onRename: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const row = (icon: string, label: string, onPress: () => void, destructive = false) => (
    <Pressable
      key={label}
      style={({ pressed }) => [styles.menuRow, { backgroundColor: pressed ? c.bg.pressed : 'transparent', opacity: offline ? 0.5 : 1 }]}
      onPress={onPress}
      disabled={offline}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size="md" color={destructive ? c.error.text : c.text.primary} />
      <Text style={[textStyle(theme.typeTokens.bodyLg), { color: destructive ? c.error.text : c.text.primary }]}>{label}</Text>
    </Pressable>
  );
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {row('action.edit', strings.folders.rename, onRename)}
      {row('action.addToFolder', strings.folders.editChats, onEdit)}
      {row('action.delete', strings.folders.delete, onDelete, true)}
    </BottomSheet>
  );
}

function ChatChecklist({
  visible,
  chats,
  selected,
  offline,
  busy,
  onToggle,
  onSave,
  onClose,
}: {
  visible: boolean;
  chats: readonly ChatListItem[];
  selected: readonly string[];
  offline: boolean;
  busy: boolean;
  onToggle: (chatId: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ maxHeight: 560, paddingBottom: theme.space[4] }}>
        <Text style={[textStyle(theme.typeTokens.titleMd), { color: c.text.primary, paddingHorizontal: 16, paddingBottom: 8 }]}>
          {strings.folders.editChats}
        </Text>
        <ScrollView>
          {chats.length === 0 ? (
            <Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary, padding: 16 }]}>
              {strings.folders.noChats}
            </Text>
          ) : (
            chats.map((chat) => {
              const checked = selected.includes(chat.chatId);
              return (
                <Pressable
                  key={chat.chatId}
                  style={({ pressed }) => [styles.checkRow, { backgroundColor: pressed ? c.bg.pressed : 'transparent' }]}
                  onPress={() => onToggle(chat.chatId)}
                  disabled={offline || busy}
                  accessibilityRole="checkbox"
                  accessibilityLabel={chat.title}
                  accessibilityState={{ checked, disabled: offline || busy }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]} numberOfLines={1}>
                      {chat.title}
                    </Text>
                    <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]} numberOfLines={1}>
                      {chat.preview}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, { borderColor: checked ? c.brand.primary : c.text.secondary, backgroundColor: checked ? c.brand.primary : 'transparent' }]}>
                    {checked ? <Icon name="admin.success" size="sm" color={c.text.inverse} /> : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Button label="Save" onPress={onSave} disabled={offline || busy} loading={busy} fullWidth />
        </View>
      </View>
    </BottomSheet>
  );
}

export default function FoldersScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const net = useNetState();
  const { showToast } = useToast();
  const folderState = useFolders();
  const chatList = useChatList();
  const [activeSection, setActiveSection] = useState<FolderSection>('chat');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const selectedFolder = folderState.folders.find((folder) => folder.folder_id === activeFolderId);
  const folderList = useChatList(selectedFolder?.chatIds);
  const [organizationItem, setOrganizationItem] = useState<ChatListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [selectionPhase, setSelectionPhase] = useState<ChatSelectionPhase>('idle');
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const offline = !net.isConnected;
  const allChats = useMemo(
    () => [...chatList.active, ...chatList.archived].sort((a, b) => a.title.localeCompare(b.title)),
    [chatList.active, chatList.archived],
  );
  const [nameDialog, setNameDialog] = useState<{ editing: boolean; folderId: string | null; name: string } | null>(null);
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const folderItems = folderList.active;
  const selectionMode = selectionPhase !== 'idle';
  const { execute, confirmDelete, busy: swipeBusy } = useChatSwipeMutations(setPendingDelete);
  const currentItem = organizationItem
    ? folderItems.find((item) => item.chatId === organizationItem.chatId) ?? organizationItem
    : null;

  const toggleSelected = useCallback((item: ChatListItem) => {
    setSelectedIds((current) => {
      if (current === null) return [item.chatId];
      return current.includes(item.chatId) ? current.filter((id) => id !== item.chatId) : [...current, item.chatId];
    });
  }, []);
  const beginSelection = useCallback((item: ChatListItem) => {
    setSelectedIds([item.chatId]);
    setSelectionPhase('entering');
  }, []);
  const leaveSelection = useCallback(() => {
    setSelectionPhase((current) => current === 'idle' ? current : 'exiting');
  }, []);
  const finishSelectionEntry = useCallback(() => {
    setSelectionPhase((current) => current === 'entering' ? 'active' : current);
  }, []);
  const finishSelectionExit = useCallback(() => {
    setSelectedIds(null);
    setSelectionPhase('idle');
  }, []);
  const runAction = useCallback((item: ChatListItem, action: ChatSwipeActionKey) => {
    void execute([{ item, action, section: 'chats' }]);
  }, [execute]);
  const runSelectedAction = useCallback((action: ChatSwipeActionKey) => {
    if (!selectedIds) return;
    const selectedItems = folderItems.filter((item) => selectedIds.includes(item.chatId));
    setSelectionPhase('exiting');
    void execute(selectedItems.map((item) => ({ item, action, section: 'chats' })));
  }, [execute, folderItems, selectedIds]);

  const openChat = useCallback((chatId: string) => {
    const identity = conversationIdentity(chatId);
    if (identity.kind === 'memo') router.push({ pathname: '/memo/[memoId]', params: { memoId: identity.memoId } });
    else router.push({ pathname: '/chat/[chatId]', params: { chatId } });
  }, [router]);

  const showError = useCallback((error: ClassifiedError | null, fallback: string) => {
    if (error) {
      const message = error.kind === 'server' && error.code === 'FOLDER_NAME_EXISTS'
        ? strings.folders.nameTaken
        : mutationErrorMessage(error, fallback);
      showToast({ message });
    }
  }, [showToast]);

  const isNameTaken = useCallback((name: string) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return false;
    return folderState.folders.some((folder) => (
      folder.folder_id !== nameDialog?.folderId && folder.name.trim().toLowerCase() === normalized
    ));
  }, [folderState.folders, nameDialog?.folderId]);

  const openNew = () => setNameDialog({ editing: false, folderId: null, name: '' });
  const saveName = async (name: string) => {
    if (nameDialog === null) return;
    if (!nameDialog.editing && folderState.folders.length >= config.folders.maxPerUser) {
      setNameDialog(null);
      showToast({ message: strings.folders.limit });
      return;
    }
    setBusy(true);
    const error = nameDialog.editing && nameDialog.folderId
      ? await folderState.rename(nameDialog.folderId, name)
      : await folderState.create(name);
    setBusy(false);
    if (error) {
      showError(error, strings.folders.saveFailed);
      return;
    }
    setNameDialog(null);
  };

  const deleteFolder = async () => {
    if (!deleteFolderId) return;
    setBusy(true);
    const error = await folderState.remove(deleteFolderId);
    setBusy(false);
    if (error) {
      showError(error, strings.folders.deleteFailed);
      return;
    }
    setDeleteFolderId(null);
  };

  const openEdit = (folderId: string) => {
    setMenuFolderId(null);
    const folder = folderState.folders.find((candidate) => candidate.folder_id === folderId);
    setSelectedChats(folder?.chatIds ? [...folder.chatIds] : []);
    setEditFolderId(folderId);
  };

  const saveChats = async () => {
    if (!editFolderId) return;
    setBusy(true);
    const error = await folderState.setChats(editFolderId, selectedChats);
    setBusy(false);
    if (error) {
      showError(error, strings.folders.saveFailed);
      return;
    }
    setEditFolderId(null);
  };

  const folderForMenu = folderState.folders.find((folder) => folder.folder_id === menuFolderId);
  const folderForEdit = folderState.folders.find((folder) => folder.folder_id === editFolderId);
  const foldersLoading = folderState.loading && folderState.folders.length === 0;
  const showLoading = useDelayedFlag(foldersLoading);

  const folderSectionTabs = (
    <FilterTabs<FolderSection>
      tabs={[
        { value: 'chat', label: strings.folders.chatFolders },
        { value: 'manage', label: strings.folders.manageFolders },
      ]}
      activeValue={activeSection}
      onSelect={(nextSection) => {
        if (!selectionMode) setActiveSection(nextSection);
      }}
      indicatorTestID="folder-section-indicator"
    />
  );

  const manageFolders = (
    <ScrollView contentContainerStyle={styles.manageContent}>
      {folderState.folders.length === 0 ? (
        <EmptyState
          iconName="action.folder"
          title={strings.folders.noFolders}
          message={strings.folders.noFoldersBody}
        />
      ) : (
        <>
          {folderState.folders.map((folder) => (
            <Pressable
              key={folder.folder_id}
              style={({ pressed }) => [
                styles.folderRow,
                { backgroundColor: pressed ? c.bg.pressed : 'transparent' },
              ]}
              onPress={() => {
                setActiveFolderId(folder.folder_id);
                setActiveSection('chat');
              }}
              accessibilityRole="button"
              accessibilityLabel={`Open ${folder.name}`}
              accessibilityState={{ selected: activeFolderId === folder.folder_id }}
            >
              <View style={[styles.folderAvatar, { backgroundColor: c.bg.surface }]}>
                <Icon name="action.folder" size="md" color={c.brand.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]} numberOfLines={1}>{folder.name}</Text>
                <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>{strings.folders.chatsCount(folder.chatIds.length)}</Text>
              </View>
              <IconButton
                iconName="nav.more"
                iconSize="md"
                accessibilityLabel={`${folder.name} menu`}
                onPress={() => setMenuFolderId(folder.folder_id)}
                disabled={offline || busy}
              />
            </Pressable>
          ))}
          <View style={[styles.folderTip, { backgroundColor: c.bg.surface, borderColor: c.separator }]}>
            <Icon name="action.info" size="sm" color={c.brand.primary} />
            <Text style={[textStyle(theme.typeTokens.bodySm), styles.folderTipText, { color: c.text.secondary }]}>
              {strings.folders.tip}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}> 
      {folderSectionTabs}
      {offline ? <Text style={[textStyle(theme.typeTokens.bodySm), styles.offline, { color: c.text.secondary }]}>{strings.common.noConnection}</Text> : null}
      <FolderScreenTransition
        viewKey={foldersLoading ? 'loading' : folderState.error && folderState.folders.length === 0 ? 'error' : activeSection}
      >
        {foldersLoading ? (
          <View accessible={showLoading} accessibilityLabel={showLoading ? 'Loading' : undefined} style={styles.center}>
            {showLoading ? <Text style={{ color: c.text.secondary }}>Loading…</Text> : null}
          </View>
        ) : folderState.error && folderState.folders.length === 0 ? (
          <ErrorState onRetry={() => void folderState.refresh()} />
        ) : activeSection === 'manage' ? (
          manageFolders
        ) : folderState.folders.length === 0 ? (
          <EmptyState
            iconName="action.folder"
            title={strings.folders.noFolders}
            message={strings.folders.noFoldersBody}
          />
        ) : (
          <View style={styles.folderContent}>
            <ChatListModeHeader
              phase={selectionPhase}
              defaultContent={(
                <FolderTabs
                  folders={folderState.folders}
                  activeId={selectedFolder?.folder_id ?? null}
                  onSelect={setActiveFolderId}
                />
              )}
              selectionContent={(
                <ChatSelectionToolbar
                  items={folderItems}
                  section="chats"
                  selectedIds={selectedIds ?? []}
                  onClose={leaveSelection}
                  onSelectAll={() => setSelectedIds((current) => current?.length === folderItems.length ? [] : folderItems.map((item) => item.chatId))}
                  onAction={runSelectedAction}
                  busy={swipeBusy}
                />
              )}
              onEntered={finishSelectionEntry}
              onExited={finishSelectionExit}
            />
            <FolderListTransition
              folderId={selectedFolder?.folder_id ?? null}
              items={folderItems}
              renderList={(visibleItems) => folderList.error && visibleItems.length === 0 ? (
                <ErrorState onRetry={() => void folderList.reload()} />
              ) : (
                <FlatList
                  data={visibleItems}
                  keyExtractor={(item) => item.chatId}
                  renderItem={({ item }) => (
                    <ChatSwipeableRow
                      item={item}
                      section="chats"
                      compactPreview
                      onPress={openChat}
                      onLongPress={setOrganizationItem}
                      onSelect={selectionMode ? toggleSelected : beginSelection}
                      selected={selectedIds?.includes(item.chatId) ?? false}
                      selectionMode={selectionMode}
                      selectionPhase={selectionPhase}
                      onAction={runAction}
                    />
                  )}
                  getItemLayout={(_, index) => ({ length: 72, offset: 72 * index, index })}
                  initialNumToRender={12}
                  maxToRenderPerBatch={12}
                  windowSize={7}
                  removeClippedSubviews={false}
                  refreshControl={<RefreshControl refreshing={folderList.refreshing} onRefresh={() => void folderList.refresh()} tintColor={c.brand.primary} colors={[c.brand.primary]} />}
                  ListEmptyComponent={folderList.loading ? null : <EmptyState title={strings.chatList.emptyTitle} message={strings.chatList.emptyBody} />}
                  contentContainerStyle={visibleItems.length === 0 ? styles.emptyContent : undefined}
                />
              )}
            />
          </View>
        )}
      </FolderScreenTransition>

      {!selectionMode ? (
        <FloatingActionButton
          accessibilityLabel={strings.folders.newFolder}
          onPress={openNew}
          disabled={offline || busy}
        />
      ) : null}

      {!selectionMode ? <ChatOrganizationActions item={currentItem} folders={folderState} onClose={() => setOrganizationItem(null)} /> : null}

      <FolderMenu
        visible={folderForMenu !== undefined}
        offline={offline || busy}
        onClose={() => setMenuFolderId(null)}
        onRename={() => {
          if (folderForMenu) setNameDialog({ editing: true, folderId: folderForMenu.folder_id, name: folderForMenu.name });
          setMenuFolderId(null);
        }}
        onEdit={() => {
          if (folderForMenu) openEdit(folderForMenu.folder_id);
        }}
        onDelete={() => {
          if (folderForMenu) setDeleteFolderId(folderForMenu.folder_id);
          setMenuFolderId(null);
        }}
      />
      <FolderNameDialog
        key={nameDialog ? `${nameDialog.editing}-${nameDialog.folderId ?? 'new'}` : 'folder-name-dialog'}
        visible={nameDialog !== null}
        initialName={nameDialog?.name ?? ''}
        editing={nameDialog?.editing ?? false}
        busy={busy}
        isNameTaken={isNameTaken}
        onDismiss={() => setNameDialog(null)}
        onSave={(name) => void saveName(name)}
      />
      <ChatChecklist
        visible={folderForEdit !== undefined}
        chats={allChats}
        selected={selectedChats}
        offline={offline}
        busy={busy}
        onToggle={(chatId) => setSelectedChats((current) => current.includes(chatId) ? current.filter((id) => id !== chatId) : [...current, chatId])}
        onSave={() => void saveChats()}
        onClose={() => setEditFolderId(null)}
      />
      <Dialog
        visible={deleteFolderId !== null}
        title={strings.folders.deleteTitle}
        message={strings.folders.deleteBody}
        confirmLabel={strings.folders.delete}
        onConfirm={() => void deleteFolder()}
        onDismiss={() => setDeleteFolderId(null)}
        destructive
      />
      <Dialog
        visible={pendingDelete !== null}
        title={strings.chatInfo.deleteTitle}
        message={strings.chatInfo.deleteBody}
        confirmLabel={strings.organization.deleteConversation}
        destructive
        busy={swipeBusy}
        onDismiss={() => setPendingDelete(null)}
        onConfirm={() => {
          const ids = pendingDelete;
          setPendingDelete(null);
          if (ids) void confirmDelete(ids);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  folderContent: { flex: 1 },
  emptyContent: { flexGrow: 1 },
  manageContent: { flexGrow: 1, paddingTop: 16, paddingBottom: 24 },
  modalContainer: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  offline: { paddingHorizontal: 16, paddingVertical: 8 },
  folderRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  folderAvatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  folderTip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 16, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  folderTipText: { flex: 1 },
  menuRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  checkRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  checkbox: { width: 24, height: 24, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  scrim: { opacity: 1 },
  dialogCenter: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: { padding: 24, elevation: 4 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
});
