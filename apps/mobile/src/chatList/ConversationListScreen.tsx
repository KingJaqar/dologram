import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { conversationIdentity, strings, type ChatListItem } from '@dologram/shared';
import { ChatFilterTabs, type ChatFilter } from '../components/ChatFilterTabs';
import { OfflineBanner } from '../components/ConnectionBanner';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { ThemeSurface } from '../theme/ThemeSurface';
import { useFolders } from '../folders/useFolders';
import { useNetState } from '../net/netState';
import { ChatListLoadingTransition } from './ChatListLoadingTransition';
import { useChatList } from './useChatList';
import { ChatOrganizationActions } from './ChatOrganizationActions';
import { ArchiveListToolbar } from './ArchiveListToolbar';
import { ChatListModeHeader, ChatSelectionToolbar, ChatSwipeableRow, useChatSwipeMutations, type ChatSelectionPhase, type ChatSwipeActionKey } from './ChatSwipeActions';
import { Dialog } from '../components/Dialog';
import { NewConversationMenu } from '../memos/NewConversationMenu';
import { useAuth } from '../auth/AuthProvider';

export function ConversationListScreen({ section }: { section: 'chats' | 'archive' | 'ignored' | 'blocked' }) {
  const theme = useTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const net = useNetState();
  const { showToast } = useToast();
  const folderState = useFolders();
  const lists = useChatList();
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all');
  const sectionItems = section === 'chats'
    ? lists.active
    : section === 'archive'
      ? lists.archived
      : section === 'ignored'
        ? lists.ignored
        : lists.blocked;
  const items = section === 'chats'
    ? activeFilter === 'unread'
      ? sectionItems.filter((item) => item.unreadCount > 0)
      : activeFilter === 'groups'
        ? sectionItems.filter((item) => item.isGroup)
        : activeFilter === 'memo'
          ? sectionItems.filter((item) => item.conversation?.kind === 'memo')
        : activeFilter === 'starred'
          ? sectionItems.filter((item) => item.pinned && !item.savedMessages)
          : sectionItems
    : sectionItems;
  const [organizationItem, setOrganizationItem] = useState<ChatListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [selectionPhase, setSelectionPhase] = useState<ChatSelectionPhase>('idle');
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const openingChatRef = useRef<string | null>(null);
  // Keep folder membership and mute/archive state in the sheet current after a mutation.
  const currentItem = organizationItem ? items.find((item) => item.chatId === organizationItem.chatId) ?? organizationItem : null;
  const { execute, confirmDelete, busy: swipeBusy } = useChatSwipeMutations(setPendingDelete);
  useFocusEffect(useCallback(() => {
    // A list stays mounted behind the native chat transition. Reset the guard only
    // when it is focused again so rapid taps cannot stack duplicate chat routes.
    openingChatRef.current = null;
  }, []));
  const openChat = useCallback((chatId: string) => {
    if (!chatId || openingChatRef.current !== null) return;
    openingChatRef.current = chatId;
    try {
      const identity = conversationIdentity(chatId);
      if (identity.kind === 'memo') router.push({ pathname: '/memo/[memoId]', params: { memoId: identity.memoId } });
      else router.push({ pathname: '/chat/[chatId]', params: { chatId } });
    } catch {
      // Keep the row usable if navigation rejects synchronously.
      openingChatRef.current = null;
    }
  }, [router]);
  const selectionMode = selectionPhase !== 'idle';
  const toggleSelected = useCallback((item: ChatListItem) => {
    setSelectedIds((current) => {
      if (current === null) return [item.chatId];
      return current.includes(item.chatId) ? current.filter((id) => id !== item.chatId) : [...current, item.chatId];
    });
  }, []);
  const beginSelection = useCallback((item: ChatListItem) => {
    setSelectedIds((current) => current ?? [item.chatId]);
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
    void execute([{ item, action, section }]);
  }, [execute, section]);
  const runSelectedAction = useCallback((action: ChatSwipeActionKey) => {
    if (!selectedIds) return;
    const selectedItems = items.filter((item) => selectedIds.includes(item.chatId));
    setSelectionPhase('exiting');
    void execute(selectedItems.map((item) => ({ item, action, section })));
  }, [execute, items, section, selectedIds]);
  const selectionToolbar = (
    <ChatSelectionToolbar
      items={items}
      section={section}
      selectedIds={selectedIds ?? []}
      onClose={leaveSelection}
      onSelectAll={() => setSelectedIds((current) => current?.length === items.length ? [] : items.map((item) => item.chatId))}
      onAction={runSelectedAction}
      busy={swipeBusy}
    />
  );
  const renderItem = useCallback(({ item }: { item: ChatListItem }) => (
    <ChatSwipeableRow
      item={item}
      section={section}
      onPress={openChat}
      onLongPress={setOrganizationItem}
      onSelect={selectionMode ? toggleSelected : beginSelection}
      selected={selectedIds?.includes(item.chatId) ?? false}
      selectionMode={selectionMode}
      selectionPhase={selectionPhase}
      onAction={runAction}
    />
  ), [beginSelection, openChat, runAction, section, selectedIds, selectionMode, selectionPhase, toggleSelected]);
  const { error, reload } = lists;
  useEffect(() => {
    if (error && items.length > 0) showToast({ message: strings.common.couldNotLoad, actionLabel: strings.common.retry, onAction: () => void reload() });
  }, [error, items.length, reload, showToast]);

  const empty = section === 'chats'
    ? [strings.chatList.emptyTitle, strings.chatList.emptyBody]
    : section === 'archive'
      ? [strings.chatList.noArchived, strings.chatList.noArchivedBody]
      : section === 'ignored'
        ? [strings.chatList.noIgnored, strings.chatList.noIgnoredBody]
        : [strings.chatList.noBlocked, strings.chatList.noBlockedBody];

  return (
    <ThemeSurface style={[styles.screen, { backgroundColor: theme.colors.bg.app }]}>
      {section === 'chats' ? (
        <ChatListModeHeader
          phase={selectionPhase}
          defaultContent={<ChatFilterTabs activeFilter={activeFilter} onSelect={setActiveFilter} />}
          selectionContent={selectionToolbar}
          onEntered={finishSelectionEntry}
          onExited={finishSelectionExit}
        />
      ) : null}
      {!net.isConnected ? <OfflineBanner /> : null}
      {section === 'archive' ? <ArchiveListToolbar items={items} /> : section === 'ignored' ? (
        <ArchiveListToolbar items={items} title={strings.chatList.ignored} />
      ) : null}
      {section !== 'chats' && selectionMode ? (
        <ChatListModeHeader
          phase={selectionPhase}
          defaultContent={null}
          selectionContent={selectionToolbar}
          onEntered={finishSelectionEntry}
          onExited={finishSelectionExit}
          collapseWhenIdle
        />
      ) : null}
      <ChatListLoadingTransition key={session?.user.id} loading={lists.loading} launchKey={section === 'chats' ? session?.user.id : undefined}>
        {error && items.length === 0 ? <ErrorState onRetry={() => void reload()} /> : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.chatId}
            renderItem={renderItem}
            getItemLayout={(_, index) => ({ length: 72, offset: 72 * index, index })}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            removeClippedSubviews={false}
            refreshControl={<RefreshControl refreshing={lists.refreshing} onRefresh={() => void lists.refresh()} tintColor={theme.colors.brand.primary} colors={[theme.colors.brand.primary]} />}
            ListEmptyComponent={lists.loading ? null : <EmptyState title={empty[0]} message={empty[1]} />}
            contentContainerStyle={[
              styles.listContent,
              items.length === 0 ? styles.emptyContent : undefined,
              { paddingBottom: insets.bottom + FAB_BOTTOM_OFFSET + FAB_SIZE + FAB_GAP },
            ]}
          />
        )}
      </ChatListLoadingTransition>
      {!selectionMode ? <ChatOrganizationActions item={currentItem} folders={folderState} ignored={section === 'ignored'} blocked={section === 'blocked'} onClose={() => setOrganizationItem(null)} /> : null}
      {section === 'chats' && !selectionMode ? (
        <NewConversationMenu />
      ) : null}
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
    </ThemeSurface>
  );
}

const FAB_SIZE = 56;
const FAB_BOTTOM_OFFSET = 16;
const FAB_GAP = 16;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingBottom: FAB_BOTTOM_OFFSET + FAB_SIZE + FAB_GAP },
  emptyContent: { flexGrow: 1 },
});
