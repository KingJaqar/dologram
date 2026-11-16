import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  SectionList,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';
import { useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { StackNavigationProp } from 'expo-router/js-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { strings, type ChatListItem, type MemoSearchResult } from '@dologram/shared';
import { useAuth } from '../src/auth/AuthProvider';
import { useChatList } from '../src/chatList/useChatList';
import { Button } from '../src/components/Button';
import { ContentCrossfade } from '../src/components/ContentCrossfade';
import { ErrorState } from '../src/components/EmptyState';
import { FilterTabs } from '../src/components/FilterTabs';
import { Icon } from '../src/components/Icon';
import { goBackOrReplace } from '../src/navigation/goBackOrReplace';
import { getLocalDatabase } from '../src/queue/db';
import { useNetState } from '../src/net/netState';
import { openDirectChat } from '../src/chats/directChat';
import { ids } from '../src/lib/ids';
import { supabase } from '../src/lib/supabase';
import { normalizeSearch } from '../src/search/matching';
import { countMessageMatches, type ConversationSummary } from '../src/search/query';
import { loadDirectoryPeople, loadSearchGroups, loadSearchPeople, rankSearchNames, type SearchPerson } from '../src/search/people';
import { SearchResultRow } from '../src/search/SearchResultRow';
import { SearchProgress } from '../src/search/SearchProgress';
import { SearchSuggestions, type ResolvedHistoryItem } from '../src/search/SearchSuggestions';
import { SearchToolbar } from '../src/search/SearchToolbar';
import { useSearchInputFocus } from '../src/search/transition';
import { useMessageSearch } from '../src/search/useMessageSearch';
import { useSearchHistory, type SearchHistoryEntry } from '../src/search/history';
import { useSearchContentActive } from '../src/search/useSearchContentActive';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useToast } from '../src/components/Toast';
import { useMemoAccess } from '../src/memos/MemoProvider';
import { MemoSearchResultRow } from '../src/search/MemoSearchResultRow';

const CATEGORIES = ['all', 'people', 'groups', 'messages'] as const;
type Category = (typeof CATEGORIES)[number];

function scalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function SearchScreen() {
  const { session } = useAuth();
  return session ? <AccountSearch key={session.user.id} userId={session.user.id} /> : null;
}

function AccountSearch({ userId }: { userId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation<StackNavigationProp<ReactNavigation.RootParamList>>();
  const net = useNetState();
  const { showToast } = useToast();
  const focused = useIsFocused();
  const contentActive = useSearchContentActive(focused, theme.reduceMotion);
  const params = useLocalSearchParams<{ originX?: string | string[]; query?: string | string[]; category?: string }>();
  const insets = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  const opening = useRef(false);
  const leaving = useRef(false);
  const personRequest = useRef<AbortController | null>(null);
  const [query, setQuery] = useState(() => scalar(params.query) ?? '');
  const [category, setCategory] = useState<Category>('all');
  const [peopleRetry, setPeopleRetry] = useState(0);
  const [filterScrollNeeded, setFilterScrollNeeded] = useState(false);
  const normalized = normalizeSearch(query);
  const { active, archived, ignored, loading, error, reload } = useChatList();
  const { scope: memoScope } = useMemoAccess();
  const chats = useMemo(() => [...active, ...archived, ...ignored].filter((item) => item.conversation?.kind !== 'memo'), [active, archived, ignored]);
  const chatIds = useMemo(() => chats.map((chat) => chat.chatId), [chats]);
  const chatIdsKey = useMemo(() => JSON.stringify([...chatIds].sort()), [chatIds]);
  const history = useSearchHistory(userId);

  useSearchInputFocus(navigation, input, focused, theme.reduceMotion);
  useEffect(() => {
    if (!focused) return;
    opening.current = false;
    leaving.current = false;
    return () => personRequest.current?.abort();
  }, [focused]);

  const peopleRequestKey = `${userId}:${chatIdsKey}:${peopleRetry}`;
  const [peopleState, setPeopleState] = useState<{ key: string; people: SearchPerson[]; error: boolean }>({
    key: '', people: [], error: false,
  });
  useEffect(() => {
    const controller = new AbortController();
    if (!userId || loading) return () => controller.abort();
    void getLocalDatabase()
      .then((db) => loadSearchPeople(db, userId, chatIds, '', controller.signal))
      .then((people) => {
        if (!controller.signal.aborted) setPeopleState({ key: peopleRequestKey, people, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setPeopleState({ key: peopleRequestKey, people: [], error: true });
      });
    return () => controller.abort();
  }, [chatIds, chatIdsKey, loading, peopleRequestKey, userId]);

  const groupRequestKey = `${userId}:${chatIdsKey}:${normalized}`;
  const [groupState, setGroupState] = useState<{ key: string; chatIds: string[]; error: boolean }>({ key: '', chatIds: [], error: false });
  useEffect(() => {
    const controller = new AbortController();
    if (!userId || loading || !normalized) return () => controller.abort();
    void getLocalDatabase()
      .then((db) => loadSearchGroups(db, userId, chatIds, normalized, controller.signal))
      .then((groupIds) => {
        if (!controller.signal.aborted) setGroupState({ key: groupRequestKey, chatIds: groupIds, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setGroupState({ key: groupRequestKey, chatIds: [], error: true });
      });
    return () => controller.abort();
  }, [chatIds, chatIdsKey, groupRequestKey, loading, normalized, userId]);

  const directoryEnabled = contentActive && net.isConnected && !!normalized && (category === 'all' || category === 'people');
  const directoryKey = `${peopleRequestKey}:${normalized}`;
  const [directoryState, setDirectoryState] = useState<{ key: string; people: SearchPerson[]; error: boolean }>({ key: '', people: [], error: false });
  useEffect(() => {
    if (!directoryEnabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void getLocalDatabase()
        .then((db) => loadDirectoryPeople(db, userId, chatIds, normalized, controller.signal))
        .then((people) => {
          if (!controller.signal.aborted) setDirectoryState({ key: directoryKey, people, error: false });
        }).catch(() => {
          if (!controller.signal.aborted) setDirectoryState({ key: directoryKey, people: [], error: true });
        });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [chatIds, directoryEnabled, directoryKey, normalized, userId]);

  const messageLoader = useCallback(async (identity: { userId: string; allowedChatIds: readonly string[]; normalizedQuery: string }, signal: AbortSignal) => {
    const db = await getLocalDatabase();
    return countMessageMatches(db, identity, identity.normalizedQuery, signal);
  }, []);
  const messageSearch = useMessageSearch(
    { userId, allowedChatIds: chatIds }, normalized, contentActive, messageLoader, chatIds,
  );
  const memoRequestKey = `${memoScope?.generation ?? 0}:${normalized}`;
  const [memoState, setMemoState] = useState<{ key: string; results: MemoSearchResult[]; error: boolean }>({ key: '', results: [], error: false });
  useEffect(() => {
    const controller = new AbortController();
    if (!memoScope || !normalized || !contentActive) return () => controller.abort();
    void import('../src/memos/search').then(({ searchMemos }) => searchMemos(memoScope, normalized, userId, controller.signal))
      .then((results) => { if (!controller.signal.aborted) setMemoState({ key: memoRequestKey, results, error: false }); })
      .catch(() => { if (!controller.signal.aborted) setMemoState({ key: memoRequestKey, results: [], error: true }); });
    return () => controller.abort();
  }, [contentActive, memoRequestKey, memoScope, normalized, userId]);
  const memoResults = memoState.key === memoRequestKey ? memoState.results : [];

  const chatsById = useMemo(() => new Map(chats.map((chat) => [chat.chatId, chat])), [chats]);
  const suggestions = useMemo(() => [...chats].sort((a, b) => b.sortMs - a.sortMs).slice(0, 10), [chats]);
  const currentPeople = useMemo(() => peopleState.key === peopleRequestKey ? peopleState.people : [], [peopleRequestKey, peopleState.key, peopleState.people]);
  const peopleError = (peopleState.key === peopleRequestKey && peopleState.error) ||
    (directoryEnabled && directoryState.key === directoryKey && directoryState.error);
  const people = useMemo(() => {
    const merged = new Map<string, SearchPerson>();
    if (directoryEnabled && directoryState.key === directoryKey) {
      for (const person of directoryState.people) merged.set(person.userId, person);
    }
    for (const person of currentPeople) merged.set(person.userId, person);
    return rankSearchNames([...merged.values()].map((person) => ({ ...person, id: person.userId })), normalized.replace(/^@/, '').trim());
  }, [currentPeople, directoryEnabled, directoryKey, directoryState, normalized]);
  const groups = useMemo(() => {
    const memberGroupIds = new Set(groupState.key === groupRequestKey ? groupState.chatIds : []);
    const messageGroupIds = new Set((messageSearch.data ?? []).map((summary) => summary.chatId));
    const candidates = chats.filter((chat) => chat.isGroup && (
      normalizeSearch(chat.title).includes(normalized) || memberGroupIds.has(chat.chatId) || messageGroupIds.has(chat.chatId)
    ));
    const rankedByTitle = rankSearchNames(
      candidates.map((chat) => ({ ...chat, id: chat.chatId })), normalized,
    );
    const titleIds = new Set(rankedByTitle.map((chat) => chat.chatId));
    const additional = candidates
      .filter((chat) => !titleIds.has(chat.chatId))
      .sort((a, b) => b.sortMs - a.sortMs || a.chatId.localeCompare(b.chatId));
    return [...rankedByTitle, ...additional];
  }, [chats, groupRequestKey, groupState.chatIds, groupState.key, messageSearch.data, normalized]);
  const groupsLoading = !!normalized && (messageSearch.loading || groupState.key !== groupRequestKey);
  const messages = useMemo(() => (messageSearch.data ?? [])
    .map((summary) => ({ summary, chat: chatsById.get(summary.chatId) }))
    .filter((item): item is { summary: ConversationSummary; chat: ChatListItem } => item.chat !== undefined),
  [chatsById, messageSearch.data]);

  const resolvedHistory = useMemo(() => {
    const peopleById = new Map(currentPeople.map((person) => [person.userId, person]));
    const resolved: ResolvedHistoryItem[] = [];
    for (const entry of history.entries) {
      if (entry.kind === 'person') {
        const person = peopleById.get(entry.id);
        if (!person) continue;
        resolved.push({ ...entry, title: person.title, subtitle: person.displayName, avatarId: person.userId, avatarUrl: person.avatarUrl, savedMessages: person.kind === 'saved' });
      } else {
        const chat = chatsById.get(entry.id);
        if (!chat) continue;
        resolved.push({ ...entry, title: chat.title, subtitle: chat.preview || strings.chat.emptyTitle, avatarId: chat.avatarId, avatarUrl: chat.avatarUrl, isGroup: chat.isGroup, savedMessages: chat.savedMessages });
      }
    }
    return resolved;
  }, [chatsById, currentPeople, history.entries]);

  const leave = useCallback((navigate: () => void) => {
    if (leaving.current || !navigation.isFocused()) return false;
    leaving.current = true;
    personRequest.current?.abort();
    Keyboard.dismiss();
    navigate();
    return true;
  }, [navigation]);

  const navigateWithHistory = useCallback((href: Parameters<typeof router.push>[0], entry: SearchHistoryEntry) => {
    if (leave(() => router.push(href))) {
      void history.record(entry).catch(() => showToast({ message: strings.search.historyWriteFailed }));
    }
  }, [history, leave, router, showToast]);

  const openChat = useCallback((chat: ChatListItem) => {
    if (opening.current) return;
    opening.current = true;
    const entry: SearchHistoryEntry = !chat.isGroup && !chat.savedMessages
      ? { kind: 'person', id: chat.avatarId, selectedAt: Date.now() }
      : { kind: 'chat', id: chat.chatId, selectedAt: Date.now() };
    navigateWithHistory({ pathname: '/chat/[chatId]', params: { chatId: chat.chatId } }, entry);
  }, [navigateWithHistory]);

  const openPerson = useCallback(async (person: SearchPerson) => {
    if (opening.current) return;
    opening.current = true;
    const request = new AbortController();
    personRequest.current = request;
    try {
      const db = await getLocalDatabase();
      if (request.signal.aborted) return;
      let chatId: string | null = null;
      const eligible = person.kind === 'directory'
        ? await loadDirectoryPeople(db, userId, chatIds, person.username || person.displayName, request.signal)
        : await loadSearchPeople(db, userId, chatIds, '', request.signal);
      if (request.signal.aborted) return;
      const current = eligible.find((candidate) => candidate.userId === person.userId);
      if (!current) {
        showToast({ message: strings.search.unavailable });
        opening.current = false;
        return;
      }
      chatId = current.chatId;
      if (!chatId) {
        if (!net.isConnected) {
          showToast({ message: strings.common.noConnection });
          opening.current = false;
          return;
        }
        const outcome = await openDirectChat({
          client: supabase,
          db,
          userId,
          otherUserId: person.userId,
          newChatId: ids.chatId(),
        });
        if (request.signal.aborted) return;
        if (outcome.kind === 'failed') {
          showToast({ message: outcome.message });
          opening.current = false;
          return;
        }
        chatId = outcome.chatId;
      }
      const entry: SearchHistoryEntry = person.userId === userId
        ? { kind: 'chat', id: chatId, selectedAt: Date.now() }
        : { kind: 'person', id: person.userId, selectedAt: Date.now() };
      navigateWithHistory({ pathname: '/chat/[chatId]', params: { chatId } }, entry);
    } catch {
      if (request.signal.aborted) return;
      showToast({ message: strings.newChat.openFailed });
      opening.current = false;
    } finally {
      if (personRequest.current === request) personRequest.current = null;
    }
  }, [chatIds, navigateWithHistory, net.isConnected, showToast, userId]);

  const openMessageConversation = useCallback((chat: ChatListItem) => {
    if (opening.current) return;
    opening.current = true;
    const entry: SearchHistoryEntry = !chat.isGroup && !chat.savedMessages
      ? { kind: 'person', id: chat.avatarId, selectedAt: Date.now() }
      : { kind: 'chat', id: chat.chatId, selectedAt: Date.now() };
    navigateWithHistory({ pathname: '/chat/[chatId]/search', params: { chatId: chat.chatId, query } }, entry);
  }, [navigateWithHistory, query]);

  const openHistory = useCallback((item: ResolvedHistoryItem) => {
    if (item.kind === 'person') {
      const person = currentPeople.find((candidate) => candidate.userId === item.id);
      if (person) void openPerson(person);
      return;
    }
    const chat = chatsById.get(item.id);
    if (chat) openChat(chat);
  }, [chatsById, currentPeople, openChat, openPerson]);

  const retryPeople = useCallback(() => {
    setPeopleRetry((value) => value + 1);
  }, []);

  const clearQuery = useCallback(() => {
    setQuery('');
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.app }]} accessibilityViewIsModal>
      <SearchToolbar
        onBack={() => leave(() => goBackOrReplace(router, { pathname: '/(main)/(tabs)', params: { searchExit: '1' } }))}
        inputRef={input}
        placeholder={strings.search.placeholder}
        accessibilityLabel={strings.search.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        value={query}
        onChangeText={setQuery}
        onSearch={setQuery}
        debounceMs={0}
      />
      <View style={styles.filterTabsShell}>
        <FilterTabs<Category>
          tabs={CATEGORIES.map((value) => ({ value, label: strings.search[value] }))}
          activeValue={category}
          onSelect={setCategory}
          accessibilityRole="button"
          barStyle={styles.filterBar}
          scrollStyle={styles.filterBar}
          rowStyle={styles.filters}
          contentContainerStyle={{ paddingLeft: 12 + insets.left, paddingRight: 12 + insets.right }}
          indicatorTestID="search-filter-indicator"
          onScrollabilityChange={setFilterScrollNeeded}
        />
        {filterScrollNeeded ? (
          <View
            pointerEvents="none"
            style={[styles.filterScrollHint, { backgroundColor: theme.colors.bg.chatList }]}
          >
            <Icon name="nav.forward" size="sm" color={theme.colors.text.muted} accessibilityLabel="" />
          </View>
        ) : null}
      </View>
      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
        {loading && chats.length === 0 && !error ? (
          <SearchProgress label={strings.search.loadingChats} rows={4} />
        ) : !normalized ? (
          <SearchSuggestions
            history={resolvedHistory}
            historyStatus={history.status}
            historyWriteError={history.writeError}
            suggestions={suggestions}
            onSelectHistory={openHistory}
            onRemoveHistory={(item) => history.remove(item)}
            onClearHistory={history.clear}
            onRetryHistory={history.retry}
            onSelectSuggestion={openChat}
          />
        ) : (
          <ContentCrossfade viewKey={error && chats.length === 0 ? 'error' : 'results'}>
            {error && chats.length === 0 ? (
              <ErrorState title={strings.search.unavailable} message={strings.search.unavailable} onRetry={() => void reload()} />
            ) : (
              <GlobalResults
                category={category}
                onCategoryChange={setCategory}
                people={people}
                groups={groups}
                messages={messages}
                memoResults={memoResults}
                messagesLoading={messageSearch.loading}
                groupsLoading={groupsLoading}
                messagesError={messageSearch.error !== null}
                onRetryMessages={messageSearch.retry}
                peopleLoading={peopleState.key !== peopleRequestKey || (directoryEnabled && directoryState.key !== directoryKey)}
                peopleError={peopleError}
                onRetryPeople={retryPeople}
                onClearQuery={clearQuery}
                query={normalized}
                onPerson={openPerson}
                onGroup={openChat}
                onMessages={openMessageConversation}
                onMemo={(result) => {
                  if (!opening.current && leave(() => router.push({ pathname: '/memo/[memoId]', params: { memoId: result.memo_id, searchItemId: result.item_id, searchBlockStart: String(result.block_start), searchQuery: normalized } }))) opening.current = true;
                }}
              />
            )}
          </ContentCrossfade>
        )}
      </View>
    </View>
  );
}

type MessageResult = { summary: ConversationSummary; chat: ChatListItem };
type SearchItem =
  | { type: 'person'; value: SearchPerson }
  | { type: 'group'; value: ChatListItem }
  | { type: 'message'; value: MessageResult }
  | { type: 'memo'; value: MemoSearchResult };
type SearchSection = { title: string; type: SearchItem['type']; data: SearchItem[]; total: number };

const GlobalSearchItemRow = React.memo(function GlobalSearchItemRow({
  item, query, messagesLoading, onPerson, onGroup, onMessages, onMemo,
}: {
  item: SearchItem;
  query: string;
  messagesLoading: boolean;
  onPerson: (person: SearchPerson) => void;
  onGroup: (chat: ChatListItem) => void;
  onMessages: (chat: ChatListItem) => void;
  onMemo: (result: MemoSearchResult) => void;
}) {
  if (item.type === 'person') {
    const person = item.value;
    const subtitle = [person.title !== person.displayName ? person.displayName : null, person.username ? `@${person.username}` : null]
      .filter(Boolean).join(' · ') || person.displayName;
    return <SearchResultRow title={person.title} subtitle={subtitle} query={query} avatarId={person.userId} avatarUrl={person.avatarUrl} savedMessages={person.kind === 'saved'} onPress={() => onPerson(person)} />;
  }
  if (item.type === 'group') {
    const chat = item.value;
    return <SearchResultRow title={chat.title} subtitle={chat.preview || strings.chat.emptyTitle} query={query} avatarId={chat.avatarId} avatarUrl={chat.avatarUrl} isGroup={chat.isGroup} onPress={() => onGroup(chat)} />;
  }
  if (item.type === 'memo') return <MemoSearchResultRow result={item.value} query={query} onPress={() => onMemo(item.value)} />;
  const { summary, chat } = item.value;
  const metadata = messagesLoading ? strings.search.counting : strings.search.matchedMessages(summary.deliveredMatchCount);
  return <SearchResultRow title={chat.title} subtitle={summary.latestMatch.preview} metadata={metadata} query={query} avatarId={chat.avatarId} avatarUrl={chat.avatarUrl} isGroup={chat.isGroup} savedMessages={chat.savedMessages} onPress={() => onMessages(chat)} />;
}, (previous, next) => (
  previous.item.type === next.item.type &&
  previous.item.value === next.item.value &&
  previous.query === next.query &&
  previous.onPerson === next.onPerson &&
  previous.onGroup === next.onGroup &&
  previous.onMessages === next.onMessages &&
  previous.onMemo === next.onMemo &&
  (previous.item.type !== 'message' || previous.messagesLoading === next.messagesLoading)
));

function GlobalResults({
  category, onCategoryChange, people, groups, messages, memoResults, messagesLoading, messagesError,
  groupsLoading, onRetryMessages, peopleLoading, peopleError, onRetryPeople, onClearQuery, query, onPerson, onGroup, onMessages, onMemo,
}: {
  category: Category;
  onCategoryChange: (category: Category) => void;
  people: SearchPerson[];
  groups: ChatListItem[];
  messages: MessageResult[];
  memoResults: MemoSearchResult[];
  messagesLoading: boolean;
  groupsLoading: boolean;
  messagesError: boolean;
  onRetryMessages: () => void;
  peopleLoading: boolean;
  peopleError: boolean;
  onRetryPeople: () => void;
  onClearQuery: () => void;
  query: string;
  onPerson: (person: SearchPerson) => void;
  onGroup: (chat: ChatListItem) => void;
  onMessages: (chat: ChatListItem) => void;
  onMemo: (result: MemoSearchResult) => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const personItems = useMemo(() => people.slice(0, 3).map((value) => ({ type: 'person' as const, value })), [people]);
  const groupItems = useMemo(() => groups.slice(0, 3).map((value) => ({ type: 'group' as const, value })), [groups]);
  const messageItems = useMemo(() => messages.slice(0, 3).map((value) => ({ type: 'message' as const, value })), [messages]);
  const memoItems = useMemo(() => memoResults.slice(0, 3).map((value) => ({ type: 'memo' as const, value })), [memoResults]);
  const sections = useMemo<SearchSection[]>(() => {
    if (category !== 'all') return [];
    const next: SearchSection[] = [];
    if (people.length > 0 || peopleError) next.push({ title: strings.search.people, type: 'person', data: personItems, total: people.length });
    if (groups.length > 0) next.push({ title: strings.search.groups, type: 'group', data: groupItems, total: groups.length });
    if (messages.length > 0 || messagesLoading || messagesError) next.push({ title: strings.search.messages, type: 'message', data: messageItems, total: messages.length });
    if (memoResults.length > 0) next.push({ title: strings.memos.library, type: 'memo', data: memoItems, total: memoResults.length });
    return next;
  }, [category, groupItems, groups.length, memoItems, memoResults.length, messageItems, messages.length, messagesError, messagesLoading, people.length, peopleError, personItems]);

  const flatItems = useMemo<SearchItem[]>(() => {
    switch (category) {
      case 'people': return people.map((value) => ({ type: 'person', value }));
      case 'groups': return groups.map((value) => ({ type: 'group', value }));
      case 'messages': return [...messages.map((value) => ({ type: 'message' as const, value })), ...memoResults.map((value) => ({ type: 'memo' as const, value }))];
      default: return [];
    }
  }, [category, groups, memoResults, messages, people]);
  const hasVisibleResults = sections.length > 0 || flatItems.length > 0;
  const waitingForPeople = peopleLoading && (category === 'all' || category === 'people') && !hasVisibleResults;
  const waitingForMessages = category === 'messages' && messagesLoading && !hasVisibleResults;
  const waitingForGroups = category === 'groups' && groupsLoading && !hasVisibleResults;
  const keyExtractor = useCallback((item: SearchItem) => item.type === 'person' ? `person:${item.value.userId}` : item.type === 'group' ? `group:${item.value.chatId}` : item.type === 'message' ? `message:${item.value.chat.chatId}` : `memo:${item.value.memo_id}:${item.value.item_id}`, []);
  const renderItem = useCallback(({ item }: { item: SearchItem }) => (
    <GlobalSearchItemRow item={item} query={query} messagesLoading={messagesLoading} onPerson={onPerson} onGroup={onGroup} onMessages={onMessages} onMemo={onMemo} />
  ), [messagesLoading, onGroup, onMemo, onMessages, onPerson, query]);
  const renderSectionHeader = useCallback(({ section }: { section: SearchSection }) => (
    <Text style={[textStyle(theme.typeTokens.titleSm), styles.sectionHeader, { color: c.text.primary }]}>{section.title}</Text>
  ), [c.text.primary, theme.typeTokens.titleSm]);
  const renderSectionFooter = useCallback(({ section }: { section: SearchSection }) => (
    section.type === 'person' && peopleError ? <View style={styles.errorFooter}><Text accessibilityRole="alert" style={[textStyle(theme.typeTokens.bodyMd), { color: c.error.text }]}>{strings.search.historyLoadFailed}</Text><Button variant="secondary" label={strings.search.retry} onPress={onRetryPeople} /></View> : section.type === 'message' && messagesLoading ? <Text style={[textStyle(theme.typeTokens.bodyMd), styles.status, { color: c.text.secondary }]}>{strings.search.counting}</Text> : section.total > 3 ? <Button variant="text" label={strings.search.seeAll} onPress={() => onCategoryChange(section.type === 'person' ? 'people' : section.type === 'group' ? 'groups' : 'messages')} /> : null
  ), [c.error.text, c.text.secondary, messagesLoading, onCategoryChange, onRetryPeople, peopleError, theme.typeTokens.bodyMd]);

  const visiblePeopleError = category === 'people' && peopleError;
  const empty = useMemo(() => (
    <SearchEmptyState
      message={visiblePeopleError ? strings.search.historyLoadFailed : strings.search.emptyResultsBody}
      actionLabel={visiblePeopleError ? strings.search.retry : strings.search.clear}
      onAction={visiblePeopleError ? onRetryPeople : onClearQuery}
    />
  ), [onClearQuery, onRetryPeople, visiblePeopleError]);
  const flatListEmpty = useMemo(() => waitingForGroups || waitingForMessages ? <Text style={[textStyle(theme.typeTokens.bodyMd), styles.status, { color: c.text.secondary }]}>{strings.search.counting}</Text> : category === 'messages' && messagesError ? <View style={styles.errorFooter}><Text accessibilityRole="alert" style={[textStyle(theme.typeTokens.bodyMd), { color: c.error.text }]}>{strings.search.failed}</Text><Button variant="secondary" label={strings.search.retry} onPress={onRetryMessages} /></View> : empty, [c.error.text, c.text.secondary, category, empty, messagesError, onRetryMessages, theme.typeTokens.bodyMd, waitingForGroups, waitingForMessages]);
  const sectionListFooter = useMemo(() => messagesError ? <View style={styles.errorFooter}><Text accessibilityRole="alert" style={[textStyle(theme.typeTokens.bodyMd), { color: c.error.text }]}>{strings.search.failed}</Text><Button variant="secondary" label={strings.search.retry} onPress={onRetryMessages} /></View> : null, [c.error.text, messagesError, onRetryMessages, theme.typeTokens.bodyMd]);

  return (
    <>
      {waitingForPeople ? (
        <SearchProgress label="Loading people…" />
      ) : category === 'all' ? (
        <SectionList<SearchItem, SearchSection>
          sections={sections}
          keyboardShouldPersistTaps="handled"
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={renderSectionFooter}
          ListEmptyComponent={empty}
          ListFooterComponent={sectionListFooter}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          contentContainerStyle={sections.length === 0 ? styles.emptyList : undefined}
        />
      ) : (
        <FlatList<SearchItem>
          data={flatItems}
          keyboardShouldPersistTaps="handled"
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={flatListEmpty}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          contentContainerStyle={flatItems.length === 0 ? styles.emptyList : undefined}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, minHeight: 0 },
  filterTabsShell: { position: 'relative' },
  filterBar: { height: 60, flexGrow: 0, flexShrink: 0, borderBottomWidth: 0 },
  filters: { height: 59, minHeight: 59, paddingVertical: 8, gap: 2, alignItems: 'center' },
  filterScrollHint: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 36, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  emptyList: { flexGrow: 1 },
  status: { padding: 20 },
  errorFooter: { padding: 16, gap: 8, alignItems: 'center' },
  searchEmpty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 16 },
  searchEmptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  searchEmptyText: { maxWidth: 320, textAlign: 'center' },
});

const SearchEmptyState = React.memo(function SearchEmptyState({ message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.searchEmpty}>
      <View style={[styles.searchEmptyIcon, { backgroundColor: c.bg.surface }]}>
        <Icon name="action.search" size="lg" color={c.text.muted} />
      </View>
      <Text
        style={[textStyle(theme.typeTokens.titleSm), styles.searchEmptyText, { color: c.text.primary }]}
      >
        {strings.search.emptyResultsTitle}
      </Text>
      <Text style={[textStyle(theme.typeTokens.bodyMd), styles.searchEmptyText, { color: c.text.secondary }]}>
        {message}
      </Text>
      {actionLabel && onAction ? <Button variant="secondary" label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
});
