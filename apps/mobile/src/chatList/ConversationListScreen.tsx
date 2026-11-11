import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { strings, type ChatListItem } from '@dologram/shared';
import { ChatRow } from '../components/ChatRow';
import { ChatFilterTabs, type ChatFilter } from '../components/ChatFilterTabs';
import { OfflineBanner } from '../components/ConnectionBanner';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { useFolders } from '../folders/useFolders';
import { useNetState } from '../net/netState';
import { ChatListLoadingTransition } from './ChatListLoadingTransition';
import { useChatList } from './useChatList';
import { ChatOrganizationActions } from './ChatOrganizationActions';
import { ArchiveListToolbar } from './ArchiveListToolbar';

export function ConversationListScreen({ section }: { section: 'chats' | 'archive' | 'ignored' }) {
  const theme = useTheme();
  const router = useRouter();
  const net = useNetState();
  const { showToast } = useToast();
  const folderState = useFolders();
  const lists = useChatList();
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all');
  const sectionItems = section === 'chats' ? lists.active : section === 'archive' ? lists.archived : lists.ignored;
  const items = section === 'chats'
    ? activeFilter === 'unread'
      ? sectionItems.filter((item) => item.unreadCount > 0)
      : activeFilter === 'groups'
        ? sectionItems.filter((item) => item.isGroup)
        : activeFilter === 'starred'
          ? sectionItems.filter((item) => item.pinned && !item.savedMessages)
          : sectionItems
    : sectionItems;
  const [organizationItem, setOrganizationItem] = useState<ChatListItem | null>(null);
  const openingChatRef = useRef<string | null>(null);
  // Keep folder membership and mute/archive state in the sheet current after a mutation.
  const currentItem = organizationItem ? items.find((item) => item.chatId === organizationItem.chatId) ?? organizationItem : null;
  useFocusEffect(useCallback(() => {
    // A list stays mounted behind the native chat transition. Reset the guard only
    // when it is focused again so rapid taps cannot stack duplicate chat routes.
    openingChatRef.current = null;
  }, []));
  const openChat = useCallback((chatId: string) => {
    if (!chatId || openingChatRef.current !== null) return;
    openingChatRef.current = chatId;
    try {
      router.push({ pathname: '/chat/[chatId]', params: { chatId } });
    } catch {
      // Keep the row usable if navigation rejects synchronously.
      openingChatRef.current = null;
    }
  }, [router]);
  const renderItem = useCallback(({ item }: { item: ChatListItem }) => (
    <ChatRow item={item} onPress={openChat} onLongPress={setOrganizationItem} />
  ), [openChat]);
  const { error, reload } = lists;
  useEffect(() => {
    if (error && items.length > 0) showToast({ message: strings.common.couldNotLoad, actionLabel: strings.common.retry, onAction: () => void reload() });
  }, [error, items.length, reload, showToast]);

  const empty = section === 'chats'
    ? [strings.chatList.emptyTitle, strings.chatList.emptyBody]
    : section === 'archive'
      ? [strings.chatList.noArchived, strings.chatList.noArchivedBody]
      : [strings.chatList.noIgnored, strings.chatList.noIgnoredBody];

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.app }]}>
      {section === 'chats' ? <ChatFilterTabs activeFilter={activeFilter} onSelect={setActiveFilter} /> : null}
      {!net.isConnected ? <OfflineBanner /> : null}
      {section === 'archive' ? <ArchiveListToolbar items={items} /> : section === 'ignored' ? (
        <Text accessibilityRole="header" style={[textStyle(theme.typeTokens.titleMd), styles.title, { color: theme.colors.text.primary }]}>{strings.chatList.ignored}</Text>
      ) : null}
      <ChatListLoadingTransition loading={lists.loading}>
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
            contentContainerStyle={items.length === 0 ? styles.emptyContent : undefined}
          />
        )}
      </ChatListLoadingTransition>
      <ChatOrganizationActions item={currentItem} folders={folderState} ignored={section === 'ignored'} onClose={() => setOrganizationItem(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  emptyContent: { flexGrow: 1 },
  title: { paddingHorizontal: 16, paddingVertical: 12 },
});
