import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { strings } from '@dologram/shared';
import { SearchField } from '../../../src/components/SearchField';
import { TopBar } from '../../../src/components/TopBar';
import { EmptyState } from '../../../src/components/EmptyState';
import { Icon } from '../../../src/components/Icon';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { textStyle } from '../../../src/theme/typography';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';
import { getLocalDatabase } from '../../../src/queue/db';
import { loadChatSnapshot, type ChatMessageItem } from '../../../src/chat/query';
import { attachmentLabel } from '../../../src/media/model';

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatSearchScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const c = theme.colors;
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId || !session?.user.id) return;
    let active = true;
    void getLocalDatabase().then((db) => loadChatSnapshot(db, chatId, session.user.id, { limit: 200 })).then((snapshot) => {
      if (active) setMessages(snapshot.messages.filter((message) => message.deletedAt === null));
    }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [chatId, session?.user.id]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return messages.filter((message) => {
      const content = `${message.senderName} ${message.content} ${message.attachments.map((item) => attachmentLabel(item.mediaType)).join(' ')}`;
      return content.toLocaleLowerCase().includes(normalized);
    }).reverse();
  }, [messages, query]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title={strings.chatInfo.search} onBack={() => goBackOrReplace(router, { pathname: '/chat/[chatId]/info', params: { chatId } })} />
      <View style={[styles.search, { padding: theme.space[4] }]}><SearchField placeholder="Search this chat" onSearch={setQuery} /></View>
      {loading ? <Text style={[textStyle(theme.typeTokens.bodyMd), styles.message, { color: c.text.secondary }]}>Loading messages…</Text> : query.trim().length === 0 ? <EmptyState iconName="action.search" title="Search this chat" message="Find messages, files and shared moments." /> : matches.length === 0 ? <EmptyState iconName="action.search" title="No results" message="Try a different word or phrase." /> : (
        <ScrollView keyboardShouldPersistTaps="handled">
          {matches.map((message) => <SearchResult key={message.messageId} message={message} onPress={() => router.replace({ pathname: '/chat/[chatId]', params: { chatId, focusMessageId: message.messageId } })} />)}
        </ScrollView>
      )}
    </View>
  );
}

function SearchResult({ message, onPress }: { message: ChatMessageItem; onPress: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const summary = message.content || (message.attachments[0] ? attachmentLabel(message.attachments[0].mediaType) : strings.chat.attachmentOnly);
  return (
    <Pressable style={({ pressed }) => [styles.result, pressed && { backgroundColor: c.bg.pressed }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${message.senderName || 'You'}: ${summary}`}>
      <View style={[styles.resultIcon, { backgroundColor: c.bg.surface }]}><Icon name={message.attachments.length > 0 ? 'action.file' : 'action.search'} size="sm" color={c.text.primary} accessibilityLabel="" /></View>
      <View style={styles.resultBody}><Text style={[textStyle(theme.typeTokens.labelMd), { color: c.text.primary }]}>{message.senderName || 'You'} · {formatDate(message.createdAt)}</Text><Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]} numberOfLines={2}>{summary}</Text></View>
      <Icon name="nav.forward" size="sm" color={c.text.muted} accessibilityLabel="" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: { borderBottomWidth: StyleSheet.hairlineWidth },
  message: { padding: 20 },
  result: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  resultIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  resultBody: { flex: 1, gap: 3 },
});
