import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Keyboard, Pressable, SectionList, StyleSheet, Text, View,
  useWindowDimensions, type TextInput,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChatListItem } from '@dologram/shared';
import { useAuth } from '../src/auth/AuthProvider';
import { useChatList } from '../src/chatList/useChatList';
import { Button, IconButton } from '../src/components/Button';
import { ChatRow } from '../src/components/ChatRow';
import { EmptyState, ErrorState } from '../src/components/EmptyState';
import { SearchField } from '../src/components/SearchField';
import { goBackOrReplace } from '../src/navigation/goBackOrReplace';
import { getLocalDatabase } from '../src/queue/db';
import { normalizeSearch, searchCachedMessages, type MessageMatch, type SearchCursor } from '../src/search/query';
import { subscribeCacheChange } from '../src/sync/cacheEvents';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';

const SEARCH_BUTTON_WIDTH = 44;

export default function SearchScreen() {
  const { session } = useAuth();
  return session ? <AccountSearch key={session.user.id} userId={session.user.id} /> : null;
}

function AccountSearch({ userId }: { userId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { originX } = useLocalSearchParams<{ originX?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const origin = Number(originX);
  const canExpand = Number.isFinite(origin) && !theme.reduceMotion;
  const progress = useRef(new Animated.Value(canExpand ? 0 : 1)).current;
  const input = useRef<TextInput>(null);
  const opening = useRef(false);
  const [query, setQuery] = useState('');
  const normalized = normalizeSearch(query);
  const { active, archived, ignored, loading, error, reload } = useChatList();
  const chats = useMemo(() => [...active, ...archived, ...ignored], [active, archived, ignored]);
  const chatIds = useMemo(() => JSON.stringify(chats.map((chat) => chat.chatId).sort()), [chats]);
  const duration = theme.duration('normal');
  const startLeft = Math.max(0, Math.min(width - SEARCH_BUTTON_WIDTH, origin - SEARCH_BUTTON_WIDTH / 2));

  useFocusEffect(useCallback(() => { opening.current = false; }, []));
  useEffect(() => {
    if (!canExpand) {
      progress.setValue(1);
      input.current?.focus();
      return;
    }
    const transition = Animated.timing(progress, {
      toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    });
    transition.start(({ finished }) => { if (finished) input.current?.focus(); });
    return () => transition.stop();
  }, [canExpand, duration, progress]);

  const openChat = useCallback((chatId: string, focusMessageId?: string) => {
    if (opening.current) return;
    opening.current = true;
    Keyboard.dismiss();
    router.push({
      pathname: '/chat/[chatId]',
      params: focusMessageId ? { chatId, focusMessageId } : { chatId },
    });
  }, [router]);

  return (
    <View style={styles.screen} accessibilityViewIsModal>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg.app, opacity: progress }]}
      />
      <View style={[styles.toolbar, { marginTop: insets.top }]}>
        <Animated.View style={{ marginLeft: insets.left + 4, opacity: progress }}>
          <IconButton iconName="nav.back" accessibilityLabel="Go back" onPress={() => goBackOrReplace(router)} />
        </Animated.View>
        <Animated.View style={[
          styles.field,
          {
            left: canExpand ? progress.interpolate({ inputRange: [0, 1], outputRange: [startLeft, insets.left + 52] }) : insets.left + 52,
            right: canExpand ? progress.interpolate({ inputRange: [0, 1], outputRange: [width - startLeft - SEARCH_BUTTON_WIDTH, insets.right + 12] }) : insets.right + 12,
          },
        ]}>
          <SearchField
            inputRef={input}
            placeholder="Search chats and messages"
            accessibilityLabel="Search chats and messages"
            autoCapitalize="none"
            autoCorrect={false}
            onSearch={setQuery}
            debounceMs={0}
          />
        </Animated.View>
      </View>
      <Animated.View style={[styles.screen, { opacity: progress, paddingBottom: insets.bottom }]}>
        {!normalized ? (
          <EmptyState iconName="action.search" title="Search DoloGram" message="Find conversations, messages and attachments." />
        ) : error && chats.length === 0 ? (
          <ErrorState title="Couldn't load chats" message="Try searching again." onRetry={() => void reload()} />
        ) : loading ? (
          <ActivityIndicator style={styles.loader} color={theme.colors.brand.primary} accessibilityLabel="Loading chats" />
        ) : (
          <SearchResults key={JSON.stringify([normalized, chatIds])} chats={chats} chatIds={chatIds} userId={userId} query={normalized} openChat={openChat} />
        )}
      </Animated.View>
    </View>
  );
}

type Result = { chat: ChatListItem } | { message: MessageMatch };

function SearchResults({ chats, chatIds, userId, query, openChat }: {
  chats: ChatListItem[];
  chatIds: string;
  userId: string;
  query: string;
  openChat: (chatId: string, messageId?: string) => void;
}) {
  const theme = useTheme();
  const chatsById = useMemo(() => new Map(chats.map((chat) => [chat.chatId, chat])), [chats]);
  const [results, setResults] = useState<MessageMatch[]>([]);
  const [next, setNext] = useState<SearchCursor | null>(null);
  const [request, setRequest] = useState<{ cursor: SearchCursor | null }>({ cursor: null });
  const [settled, setSettled] = useState<typeof request | null>(null);
  const [failed, setFailed] = useState(false);
  const loading = settled !== request;

  useEffect(() => subscribeCacheChange(() => setRequest({ cursor: null })), []);
  useEffect(() => {
    const controller = new AbortController();
    const search = async () => {
      try {
        const page = chatIds === '[]' ? { matches: [], next: null } : await searchCachedMessages(
          await getLocalDatabase(), userId, chatIds, query, request.cursor, controller.signal,
        );
        if (controller.signal.aborted) return;
        setResults((previous) => request.cursor ? [...previous, ...page.matches] : page.matches);
        setNext(page.next);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setSettled(request);
      }
    };
    const timer = setTimeout(() => void search(), request.cursor ? 0 : 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [chatIds, query, request, userId]);

  const matchingChats = chats.filter((chat) => normalizeSearch(chat.title).includes(query));
  const messages = results.filter((message) => chatsById.has(message.chatId));
  const sections: { title: string; data: Result[] }[] = [
    { title: 'Chats', data: matchingChats.map((chat) => ({ chat })) },
    { title: 'Messages', data: messages.map((message) => ({ message })) },
  ].filter((section) => section.data.length > 0);

  return (
    <SectionList<Result>
      sections={sections}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      stickySectionHeadersEnabled={false}
      keyExtractor={(item) => 'chat' in item ? `chat:${item.chat.chatId}` : item.message.messageId}
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={[styles.section, textStyle(theme.typeTokens.titleSm), { color: theme.colors.text.primary }]}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => {
        if ('chat' in item) return <ChatRow item={item.chat} onPress={openChat} />;
        const { message } = item;
        const title = chatsById.get(message.chatId)?.title ?? '';
        const date = new Date(message.createdAt).toLocaleDateString([], { dateStyle: 'medium' });
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${message.sender}, ${date}, ${message.preview}`}
            onPress={() => openChat(message.chatId, message.messageId)}
            style={({ pressed }) => [styles.message, pressed && { backgroundColor: theme.colors.bg.pressed }]}
          >
            <Text numberOfLines={1} style={[textStyle(theme.typeTokens.labelMd), { color: theme.colors.text.primary }]}>
              {title} · {message.sender} · {date}
            </Text>
            <Text numberOfLines={2} style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.text.secondary }]}>
              {message.preview}
            </Text>
          </Pressable>
        );
      }}
      contentContainerStyle={sections.length === 0 ? styles.emptyList : undefined}
      ListEmptyComponent={loading || failed ? null : (
        <EmptyState iconName="action.search" title="No results" message="Try a different word or phrase." />
      )}
      ListFooterComponent={loading ? (
        <ActivityIndicator style={styles.loader} color={theme.colors.brand.primary} accessibilityLabel="Searching messages" />
      ) : failed ? (
        <View style={styles.footer}>
          <Text accessibilityRole="alert" style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.error.text }]}>
            {"Couldn't search messages."}
          </Text>
          <Button variant="secondary" label="Retry" onPress={() => setRequest({ ...request })} />
        </View>
      ) : next ? (
        <View style={styles.footer}>
          <Button variant="secondary" label="Show more messages" onPress={() => setRequest({ cursor: next })} />
        </View>
      ) : null}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: { height: 56, justifyContent: 'center', alignItems: 'flex-start' },
  field: { position: 'absolute', top: 8, overflow: 'hidden', borderRadius: 24 },
  emptyList: { flexGrow: 1 },
  loader: { marginVertical: 24 },
  section: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  message: { minHeight: 68, paddingVertical: 10, paddingHorizontal: 16, gap: 4 },
  footer: { padding: 16, gap: 8, alignItems: 'center' },
});
