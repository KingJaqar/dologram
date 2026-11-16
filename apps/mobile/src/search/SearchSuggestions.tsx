import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ChatListItem } from '@dologram/shared';
import { strings } from '@dologram/shared';
import { Avatar } from '../components/Avatar';
import { Button, IconButton } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { textStyle } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';
import { SearchResultRow } from './SearchResultRow';
import type { SearchHistoryEntry } from './history';

export type ResolvedHistoryItem = SearchHistoryEntry & {
  title: string;
  subtitle: string;
  avatarId: string;
  avatarUrl?: string | null;
  isGroup?: boolean;
  savedMessages?: boolean;
};

type SearchSuggestionsProps = {
  history: ResolvedHistoryItem[];
  historyStatus: 'loading' | 'ready' | 'unavailable' | 'error';
  historyWriteError: boolean;
  suggestions: ChatListItem[];
  onSelectHistory: (item: ResolvedHistoryItem) => void;
  onRemoveHistory: (item: ResolvedHistoryItem) => Promise<void>;
  onClearHistory: () => Promise<void>;
  onRetryHistory: () => Promise<void>;
  onSelectSuggestion: (chat: ChatListItem) => void;
};

type SuggestionListItem = ResolvedHistoryItem | ChatListItem;

export const SearchSuggestions = React.memo(function SearchSuggestions({
  history,
  historyStatus,
  historyWriteError,
  suggestions,
  onSelectHistory,
  onRemoveHistory,
  onClearHistory,
  onRetryHistory,
  onSelectSuggestion,
}: SearchSuggestionsProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [editing, setEditing] = useState(false);
  const [clearVisible, setClearVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeEditing = editing && history.length > 0;
  const listData: SuggestionListItem[] = activeEditing ? history : suggestions;
  const keyExtractor = useCallback((item: SuggestionListItem) => 'selectedAt' in item ? `${item.kind}:${item.id}` : item.chatId, []);
  const renderItem = useCallback(({ item }: { item: SuggestionListItem }) => {
    if ('selectedAt' in item) {
      return (
        <Pressable
          style={({ pressed }) => [styles.historyRow, { backgroundColor: pressed ? c.bg.pressed : c.bg.app, borderBottomColor: c.separator }]}
          onPress={() => onSelectHistory(item)}
          accessibilityRole="button"
          accessibilityLabel={item.title}
        >
          <Avatar id={item.avatarId} displayName={item.title} imageUrl={item.avatarUrl} imageBucket={item.isGroup ? 'chat-avatars' : 'avatars'} size={48} isSavedMessages={item.savedMessages} />
          <View style={styles.historyBody}>
            <Text style={[textStyle(theme.typeTokens.titleSm), { color: c.text.primary }]} numberOfLines={1}>{item.title}</Text>
            <Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]} numberOfLines={1}>{item.subtitle}</Text>
          </View>
          <IconButton
            iconName="nav.close"
            accessibilityLabel={`Remove ${item.title}`}
            onPress={() => void onRemoveHistory(item).catch(() => undefined)}
          />
        </Pressable>
      );
    }

    return (
      <SearchResultRow
        title={item.title}
        subtitle={item.preview || strings.chat.emptyTitle}
        query=""
        avatarId={item.avatarId}
        avatarUrl={item.avatarUrl}
        isGroup={item.isGroup}
        savedMessages={item.savedMessages}
        onPress={() => onSelectSuggestion(item)}
      />
    );
  }, [c.bg.app, c.bg.pressed, c.separator, c.text.primary, c.text.secondary, onRemoveHistory, onSelectHistory, onSelectSuggestion, theme.typeTokens]);
  const listEmpty = useMemo(() => activeEditing || suggestions.length > 0 ? null : (
    <EmptyState iconName="action.search" title={strings.search.noChatsTitle} message={strings.search.noChatsBody} />
  ), [activeEditing, suggestions.length]);

  const clear = async () => {
    setBusy(true);
    try {
      await onClearHistory();
      setClearVisible(false);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (historyStatus === 'error') {
    return (
      <ErrorState
        title={strings.search.historyLoadFailed}
        message={strings.search.historyLoadFailed}
        onRetry={() => void onRetryHistory()}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        ListHeaderComponent={(
          <View>
            <View style={styles.headingRow}>
              <Text style={[textStyle(theme.typeTokens.titleSm), { color: c.text.primary }]}>{strings.search.recent}</Text>
              {history.length > 0 ? (
                <Button
                  variant="text"
                  label={activeEditing ? strings.search.done : strings.search.edit}
                  onPress={() => setEditing((value) => !value)}
                  accessibilityLabel={activeEditing ? strings.search.done : strings.search.edit}
                />
              ) : null}
            </View>
            {historyStatus === 'loading' ? (
              <HistoryLoadingPlaceholder />
            ) : historyStatus === 'unavailable' ? (
              <View style={styles.notice}>
                <Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]}>{strings.search.historyUnavailable}</Text>
                <Button variant="secondary" label={strings.search.resetHistory} onPress={() => setClearVisible(true)} />
              </View>
            ) : history.length === 0 ? (
              <Text style={[textStyle(theme.typeTokens.bodyMd), styles.emptyHint, { color: c.text.secondary }]}>
                {strings.search.noHistory}
              </Text>
            ) : activeEditing ? null : (
              <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                {history.map((item) => (
                  <Pressable
                    key={`${item.kind}:${item.id}`}
                    onPress={() => onSelectHistory(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    style={styles.railItem}
                  >
                    <Avatar id={item.avatarId} displayName={item.title} imageUrl={item.avatarUrl} imageBucket={item.isGroup ? 'chat-avatars' : 'avatars'} size={56} isSavedMessages={item.savedMessages} />
                    <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.primary }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {historyWriteError ? (
            <View style={styles.errorRow}>
              <Text accessibilityRole="alert" style={[textStyle(theme.typeTokens.bodyMd), { color: c.error.text }]}>
                {strings.search.historyWriteFailed}
              </Text>
              <Button variant="secondary" label={strings.search.retry} onPress={() => void onRetryHistory().catch(() => undefined)} />
            </View>
            ) : null}

            {history.length > 0 && !activeEditing ? (
              <Button variant="text" label={strings.search.clearHistory} onPress={() => setClearVisible(true)} />
            ) : null}

            {!activeEditing ? (
              <Text style={[textStyle(theme.typeTokens.titleSm), styles.suggestedTitle, { color: c.text.primary }]}>
                {strings.search.suggested}
              </Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.content}
      />
      <Dialog
        visible={clearVisible}
        title={historyStatus === 'unavailable' ? strings.search.resetHistoryTitle : strings.search.clearHistoryTitle}
        message={historyStatus === 'unavailable' ? strings.search.resetHistoryBody : strings.search.clearHistoryBody}
        confirmLabel={historyStatus === 'unavailable' ? strings.search.resetHistory : strings.search.clearHistory}
        onConfirm={() => void clear().catch(() => undefined)}
        onDismiss={() => setClearVisible(false)}
        destructive
        busy={busy}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 32 },
  headingRow: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rail: { paddingHorizontal: 16, gap: 16, paddingBottom: 16 },
  railItem: { width: 64, alignItems: 'center', gap: 6 },
  historyRow: { minHeight: 72, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  historyBody: { flex: 1, gap: 4 },
  emptyHint: { paddingHorizontal: 16, paddingBottom: 16 },
  notice: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  error: { paddingHorizontal: 16, paddingBottom: 8 },
  errorRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, alignItems: 'flex-start' },
  suggestedTitle: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  historyPlaceholder: { height: 110, paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  placeholderItem: { width: 64, alignItems: 'center', gap: 6 },
  placeholderAvatar: { width: 56, height: 56, borderRadius: 28 },
  placeholderLabel: { width: 48, height: 12, borderRadius: 6 },
});

const HistoryLoadingPlaceholder = React.memo(function HistoryLoadingPlaceholder() {
  const { colors } = useTheme();
  return (
    <View
      style={styles.historyPlaceholder}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={strings.search.loadingHistory}
    >
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.placeholderItem}>
          <View style={[styles.placeholderAvatar, { backgroundColor: colors.skeleton.base }]} />
          <View style={[styles.placeholderLabel, { backgroundColor: colors.skeleton.base }]} />
        </View>
      ))}
    </View>
  );
});
