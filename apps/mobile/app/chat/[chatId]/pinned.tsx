import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { strings } from '@dologram/shared';
import { TopBar } from '../../../src/components/TopBar';
import { EmptyState } from '../../../src/components/EmptyState';
import { Icon } from '../../../src/components/Icon';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { textStyle } from '../../../src/theme/typography';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';
import { getLocalDatabase } from '../../../src/queue/db';
import { loadChatSnapshot, type ChatMessageItem } from '../../../src/chat/query';
import { loadPinnedMessageIds, savePinnedMessageIds } from '../../../src/chats/preferences';

export default function PinnedMessagesScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const c = theme.colors;
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId || !session?.user.id) return;
    let active = true;
    void Promise.all([
      getLocalDatabase().then((db) => loadChatSnapshot(db, chatId, session.user.id, { limit: 200 })),
      loadPinnedMessageIds(session.user.id),
    ]).then(([snapshot, ids]) => {
      if (!active) return;
      setMessages(snapshot.messages.filter((message) => message.deletedAt === null));
      setPinnedIds(ids);
    }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [chatId, session?.user.id]);

  const pinned = useMemo(() => messages.filter((message) => pinnedIds.has(message.messageId)).reverse(), [messages, pinnedIds]);

  const toggle = async (messageId: string) => {
    if (!session?.user.id) return;
    const next = new Set(pinnedIds);
    if (next.has(messageId)) next.delete(messageId); else next.add(messageId);
    setPinnedIds(next);
    await savePinnedMessageIds(session.user.id, next);
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title={strings.chatInfo.pinnedMessages} onBack={() => goBackOrReplace(router, { pathname: '/chat/[chatId]/info', params: { chatId } })} />
      {loading ? <Text style={[styles.status, textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]}>Loading pinned messages…</Text> : pinned.length === 0 ? <EmptyState iconName="action.pin" title="No pinned messages" message="Pin important messages from the message menu." /> : (
        <ScrollView>
          {pinned.map((message) => <PinnedRow key={message.messageId} message={message} onOpen={() => router.replace({ pathname: '/chat/[chatId]', params: { chatId, focusMessageId: message.messageId } })} onToggle={() => void toggle(message.messageId)} />)}
        </ScrollView>
      )}
    </View>
  );
}

function PinnedRow({ message, onOpen, onToggle }: { message: ChatMessageItem; onOpen: () => void; onToggle: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.row}>
      <Pressable style={({ pressed }) => [styles.main, pressed && { backgroundColor: c.bg.pressed }]} onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open pinned message">
        <View style={[styles.icon, { backgroundColor: c.bg.surface }]}><Icon name="action.pin" size="sm" color={c.brand.primary} accessibilityLabel="" /></View>
        <View style={styles.body}><Text style={[textStyle(theme.typeTokens.labelMd), { color: c.text.primary }]}>{message.senderName || 'You'}</Text><Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]} numberOfLines={2}>{message.content || strings.chat.attachmentOnly}</Text></View>
      </Pressable>
      <Pressable style={styles.remove} onPress={onToggle} accessibilityRole="button" accessibilityLabel="Unpin message"><Icon name="action.unpin" size="sm" color={c.text.muted} accessibilityLabel="" /></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  status: { padding: 20 },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center' },
  main: { flex: 1, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  remove: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
});
