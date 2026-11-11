/** AND-07: forward a text message to one of the user's cached chats. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { buildChatList, strings, type ChatListItem } from '@dologram/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar } from '../src/components/Avatar';
import { EmptyState, ErrorState } from '../src/components/EmptyState';
import { SearchField } from '../src/components/SearchField';
import { TopBar } from '../src/components/TopBar';
import { goBackOrReplace } from '../src/navigation/goBackOrReplace';
import { actionToast } from '../src/notifications/toastCopy';
import { useToast } from '../src/components/Toast';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useAuth } from '../src/auth/AuthProvider';
import { enqueueTextMessage } from '../src/queue/localQueue';
import { getLocalDatabase } from '../src/queue/db';
import { loadChatSnapshot } from '../src/chat/query';
import { loadChatListRows } from '../src/chatList/query';
import { useDelayedFlag } from '../src/hooks/useDelayedFlag';
import { DelayedActivityIndicator } from '../src/components/DelayedActivityIndicator';

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : value?.[0] ?? '';
}

export default function ForwardScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const toast = useToast();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ sourceChatId?: string | string[]; messageId?: string | string[] }>();
  const sourceChatId = param(params.sourceChatId);
  const messageId = param(params.messageId);
  const userId = session?.user.id ?? '';
  const [sourceContent, setSourceContent] = useState<string | null>(null);
  const [hasAttachments, setHasAttachments] = useState(false);
  const [targets, setTargets] = useState<ChatListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [forwardingChatId, setForwardingChatId] = useState<string | null>(null);
  const showLoading = useDelayedFlag(loading);
  const forwardLock = useRef(false);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      if (!userId || !sourceChatId || !messageId) { setLoading(false); setError(true); return; }
      try {
        const db = await getLocalDatabase();
        const [snapshot, rows] = await Promise.all([
          loadChatSnapshot(db, sourceChatId, userId, { limit: 50 }),
          loadChatListRows(db, userId),
        ]);
        const message = snapshot.messages.find((candidate) => candidate.messageId === messageId);
        if (!message || !message.content.trim()) { if (active) { setLoading(false); setError(true); } return; }
        const built = [
          ...buildChatList(rows, { userId, now: new Date(), archived: false }),
          ...buildChatList(rows, { userId, now: new Date(), archived: true }),
        ];
        const unique = new Map(built.map((item) => [item.chatId, item]));
        const ordered = [...unique.values()].sort((a, b) => Number(b.savedMessages) - Number(a.savedMessages) || b.sortMs - a.sortMs || a.chatId.localeCompare(b.chatId));
        if (active) { setSourceContent(message.content); setHasAttachments(message.attachmentCount > 0); setTargets(ordered); setLoading(false); }
      } catch {
        if (active) { setLoading(false); setError(true); }
      }
    }
    void load();
    return () => { active = false; };
  }, [messageId, reloadToken, sourceChatId, userId]);

  const visibleTargets = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    if (!normalized) return targets;
    return targets.filter((target) => target.title.toLocaleLowerCase().includes(normalized));
  }, [search, targets]);

  const forwardTo = async (target: ChatListItem): Promise<void> => {
    if (!sourceContent || !userId || forwardLock.current) return;
    forwardLock.current = true;
    setForwardingChatId(target.chatId);
    try {
      const result = await enqueueTextMessage({ chatId: target.chatId, senderId: userId, content: sourceContent, feedback: 'forward', onQueued: (messageId) => toast.showToast({ id: `forward-queued:${messageId}`, message: strings.toasts.forwardQueued, variant: 'info', placement: 'top' }) });
      if (!result.ok) { toast.showToast({ ...actionToast('forwardMessage', 'error'), message: strings.queue.full }); return; }
      // Enqueue is durable, not delivered. The root subscribes to the worker's terminal outcome.
      goBackOrReplace(router, sourceChatId ? { pathname: '/chat/[chatId]', params: { chatId: sourceChatId } } : '/(main)/(tabs)');
    } catch {
      toast.showToast(actionToast('forwardMessage', 'error'));
    } finally {
      forwardLock.current = false;
      setForwardingChatId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg.app }]}>
      <TopBar title={strings.forward.title} onBack={() => goBackOrReplace(router, sourceChatId ? { pathname: '/chat/[chatId]', params: { chatId: sourceChatId } } : '/(main)/(tabs)')} />
      {showLoading ? <View style={styles.center} accessibilityLabel="Loading"><ActivityIndicator color={c.brand.primary} accessibilityLabel="Loading" /></View> : error ? <ErrorState title={strings.forward.unavailable} onRetry={() => { setError(false); setLoading(true); setReloadToken((current) => current + 1); }} /> : (
        <>
          {hasAttachments ? <View style={[styles.notice, { backgroundColor: c.info.bg }]}><Text style={[textStyle(theme.typeTokens.bodySm), { color: c.info.text }]}>{strings.chat.attachmentsNotForwarded}</Text></View> : null}
          <View style={styles.search}><SearchField placeholder={strings.forward.searchPlaceholder} onSearch={setSearch} /></View>
          {visibleTargets.length === 0 ? <EmptyState iconName="action.search" title={strings.forward.noMatches} /> : (
            <FlatList
              data={visibleTargets}
              keyExtractor={(item) => item.chatId}
              renderItem={({ item }) => {
                const busy = forwardingChatId === item.chatId;
                return <Pressable onPress={() => void forwardTo(item)} disabled={forwardingChatId !== null} accessibilityRole="button" accessibilityLabel={`Forward to ${item.title}`} accessibilityState={{ disabled: forwardingChatId !== null }} style={({ pressed }) => [styles.target, { backgroundColor: pressed ? c.bg.pressed : 'transparent', opacity: busy ? 0.5 : 1 }]}>
                  <Avatar id={item.avatarId} displayName={item.avatarName} size={48} isSavedMessages={item.savedMessages} />
                  <Text style={[textStyle(theme.typeTokens.bodyLg), styles.targetName, { color: c.text.primary }]} numberOfLines={1}>{item.title}</Text>
                  {busy ? <DelayedActivityIndicator color={c.brand.primary} accessibilityLabel="Loading" /> : null}
                </Pressable>;
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notice: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  search: { padding: 16 },
  target: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetName: { flex: 1 },
});
