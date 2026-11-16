import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { StackNavigationProp } from 'expo-router/js-stack';
import { strings } from '@dologram/shared';
import { SearchField } from '../../../src/components/SearchField';
import { TopBar } from '../../../src/components/TopBar';
import { EmptyState } from '../../../src/components/EmptyState';
import { Icon } from '../../../src/components/Icon';
import { Button } from '../../../src/components/Button';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { textStyle } from '../../../src/theme/typography';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';
import { getLocalDatabase } from '../../../src/queue/db';
import { getUnsentItems } from '../../../src/queue/localQueue';
import { loadChatSnapshot } from '../../../src/chat/query';
import { normalizeSearch } from '../../../src/search/matching';
import { searchScopedMessages, type MessageMatch, type SearchCursor, type ScopedMessagePage } from '../../../src/search/query';
import { useMessageSearch } from '../../../src/search/useMessageSearch';
import { useSearchContentActive } from '../../../src/search/useSearchContentActive';
import { HighlightedText } from '../../../src/search/HighlightedText';
import { SearchProgress } from '../../../src/search/SearchProgress';
import { useSearchInputFocus } from '../../../src/search/transition';

function resolvedParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : value?.[0] ?? '';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function pendingStatus(status: NonNullable<MessageMatch['pendingStatus']>): string {
  return strings.search.pendingStatus[status] ?? strings.search.pendingStatus.queued;
}

function appendUnique(current: readonly MessageMatch[], page: ScopedMessagePage): MessageMatch[] {
  const byId = new Map(current.map((message) => [message.messageId, message]));
  for (const message of [...page.matches, ...page.pendingMatches]) byId.set(message.messageId, message);
  return [...byId.values()];
}

export default function ChatSearchScreen() {
  const params = useLocalSearchParams<{ chatId?: string | string[]; query?: string | string[] }>();
  const chatId = resolvedParam(params.chatId);
  const queryParam = resolvedParam(params.query);
  const router = useRouter();
  const navigation = useNavigation<StackNavigationProp<ReactNavigation.RootParamList>>();
  const theme = useTheme();
  const c = theme.colors;
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const focused = useIsFocused();
  const contentActive = useSearchContentActive(focused, theme.reduceMotion);
  const input = useRef<TextInput>(null);
  const [query, setQuery] = useState(queryParam);
  const [scopeTitle, setScopeTitle] = useState<string | null>(null);
  const [loadedPage, setLoadedPage] = useState<{ key: string; matches: MessageMatch[]; next: SearchCursor | null }>({ key: '', matches: [], next: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreErrorKey, setMoreErrorKey] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const leaving = useRef(false);
  const loadMoreController = useRef<AbortController | null>(null);

  useSearchInputFocus(navigation, input, focused, theme.reduceMotion);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadMoreController.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (focused) leaving.current = false;
  }, [focused]);

  const scope = useMemo(() => ({ userId, allowedChatIds: chatId ? [chatId] : [], chatId }), [chatId, userId]);
  const loadFirstPage = useCallback(async (identity: { userId: string; allowedChatIds: readonly string[]; chatId?: string; normalizedQuery: string }, signal: AbortSignal) => {
    const db = await getLocalDatabase();
    return searchScopedMessages(db, { ...identity, chatId: chatId || identity.chatId || '' }, identity.normalizedQuery, null, signal, getUnsentItems);
  }, [chatId]);
  const search = useMessageSearch(scope, query, contentActive, loadFirstPage, chatId ? [chatId] : []);
  const normalizedQuery = normalizeSearch(query);

  useEffect(() => {
    if (!focused || !chatId || !userId) return;
    let active = true;
    void getLocalDatabase()
      .then((db) => loadChatSnapshot(db, chatId, userId, { limit: 1 }))
      .then((snapshot) => { if (active) setScopeTitle(snapshot.title); })
      .catch(() => { if (active) setScopeTitle(null); });
    return () => { active = false; };
  }, [chatId, focused, userId]);

  // Already loaded pages survive the focus refresh of the first page; a changed query, scope or
  // search epoch (cache/queue invalidation, explicit retry) drops them so results stay truthful.
  const paginationKey = JSON.stringify([userId, chatId, normalizedQuery, search.epoch]);
  const matches = useMemo(() => {
    const retained = loadedPage.key === paginationKey ? loadedPage.matches : [];
    return search.data ? appendUnique(retained, search.data) : [];
  }, [loadedPage.key, loadedPage.matches, paginationKey, search.data]);
  const next = loadedPage.key === paginationKey ? loadedPage.next : search.data?.next ?? null;
  const moreError = moreErrorKey === paginationKey;

  const loadMore = useCallback(async () => {
    if (!next || loadingMore || !chatId || !userId || !normalizedQuery || !focused) return;
    setLoadingMore(true);
    setMoreErrorKey(null);
    const controller = new AbortController();
    loadMoreController.current = controller;
    try {
      const db = await getLocalDatabase();
      const page = await searchScopedMessages(db, { userId, allowedChatIds: [chatId], chatId }, normalizedQuery, next, controller.signal, getUnsentItems);
      if (mountedRef.current && !controller.signal.aborted) {
        setLoadedPage((current) => ({
          key: paginationKey,
          matches: appendUnique(current.key === paginationKey ? current.matches : [], page),
          next: page.next,
        }));
      }
    } catch {
      if (mountedRef.current && !controller.signal.aborted) setMoreErrorKey(paginationKey);
    } finally {
      if (loadMoreController.current === controller) loadMoreController.current = null;
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [chatId, focused, loadingMore, next, normalizedQuery, paginationKey, userId]);

  const leave = useCallback((navigate: () => void) => {
    if (leaving.current || !focused) return;
    leaving.current = true;
    Keyboard.dismiss();
    navigate();
  }, [focused]);

  const openMatch = useCallback((message: MessageMatch) => leave(() => {
    router.push({ pathname: '/chat/[chatId]', params: { chatId, focusMessageId: message.messageId, searchQuery: query } });
  }), [chatId, leave, query, router]);

  const renderItem = useCallback(({ item }: { item: MessageMatch }) => (
    <SearchResult message={item} query={query} onPress={openMatch} />
  ), [openMatch, query]);

  const errorMessage = search.error === 'timeout' ? strings.search.timeout : search.error === 'unavailable' ? strings.search.unavailable : strings.search.failed;
  const scopeLabel = scopeTitle ? `${strings.chatInfo.search} · ${scopeTitle}` : strings.chatInfo.search;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title={scopeLabel} onBack={() => leave(() => goBackOrReplace(router, { pathname: '/chat/[chatId]/info', params: { chatId, searchExit: '1' } }))} />
      <View style={[styles.search, { padding: theme.space[4], borderBottomColor: c.separator }]}>
        <SearchField
          inputRef={input}
          value={query}
          onChangeText={setQuery}
          onSearch={setQuery}
          debounceMs={0}
          placeholder={strings.search.placeholder}
        />
      </View>
      {!chatId || !userId ? <EmptyState iconName="action.info" title={strings.search.unavailable} message={strings.chatInfo.unavailableBody} /> : !normalizedQuery ? (
        <EmptyState iconName="action.search" title={strings.chatInfo.search} message={strings.search.scopedPrompt} />
      ) : search.loading ? (
        <SearchProgress label={strings.search.searching} />
      ) : search.error ? (
        <View style={styles.status}>
          <Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.error.text }]}>{errorMessage}</Text>
          <Button label={strings.search.retry} variant="text" onPress={search.retry} />
        </View>
      ) : matches.length === 0 ? (
        <EmptyState iconName="action.search" title={strings.search.emptyResultsTitle} message={strings.search.emptyResultsBody} />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(message) => message.messageId}
          renderItem={renderItem}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          contentContainerStyle={styles.results}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => { if (next) void loadMore(); }}
          onEndReachedThreshold={0.25}
          ListFooterComponent={next || moreError || loadingMore ? (
            <View style={styles.footer}>
              {loadingMore ? <ActivityIndicator color={c.brand.primary} /> : moreError ? <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.error.text }]}>{strings.search.failed}</Text> : null}
              {next || moreError ? <Button label={moreError ? strings.search.retry : strings.search.showMore} variant="text" onPress={() => void loadMore()} /> : null}
            </View>
          ) : null}
          accessibilityLabel={strings.search.scopedResults}
        />
      )}
    </View>
  );
}

const SearchResult = React.memo(function SearchResult({ message, query, onPress }: { message: MessageMatch; query: string; onPress: (message: MessageMatch) => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const sender = message.sender || strings.search.you;
  const status = message.pendingStatus ? ` · ${pendingStatus(message.pendingStatus)}` : '';
  return (
    <Pressable style={({ pressed }) => [styles.result, { borderBottomColor: c.separator }, pressed && { backgroundColor: c.bg.pressed }]} onPress={() => onPress(message)} accessibilityRole="button" accessibilityLabel={`${sender}: ${message.preview}`}>
      <View style={[styles.resultIcon, { backgroundColor: c.bg.surface }]}><Icon name="action.search" size="sm" color={c.text.primary} accessibilityLabel="" /></View>
      <View style={styles.resultBody}>
        <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.text.primary }]} numberOfLines={1}>{sender} · {formatDate(message.createdAt)}{status}</Text>
        <HighlightedText text={message.preview} query={query} numberOfLines={2} style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]} />
      </View>
      <Icon name="nav.forward" size="sm" color={c.text.muted} accessibilityLabel="" />
    </Pressable>
  );
}, (previous, next) => (
  previous.query === next.query &&
  previous.onPress === next.onPress &&
  previous.message.messageId === next.message.messageId &&
  previous.message.createdAt === next.message.createdAt &&
  previous.message.sender === next.message.sender &&
  previous.message.preview === next.message.preview &&
  previous.message.pendingStatus === next.message.pendingStatus &&
  previous.message.sources === next.message.sources
));

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: { borderBottomWidth: StyleSheet.hairlineWidth },
  status: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  results: { paddingVertical: 4 },
  result: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  resultIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  resultBody: { flex: 1, gap: 2 },
  footer: { minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
