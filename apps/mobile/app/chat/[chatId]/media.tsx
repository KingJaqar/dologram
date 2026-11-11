import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { deleteChatAttachment, strings, type MediaType } from '@dologram/shared';
import { Dialog } from '../../../src/components/Dialog';
import { Button } from '../../../src/components/Button';
import { useToast } from '../../../src/components/Toast';
import { actionToast } from '../../../src/notifications/toastCopy';
import { useNetState } from '../../../src/net/netState';
import { supabase } from '../../../src/lib/supabase';
import { createSqliteCacheStore } from '../../../src/sync/cacheStore';
import { notifyCacheChange } from '../../../src/sync/cacheEvents';
import { TopBar } from '../../../src/components/TopBar';
import { EmptyState } from '../../../src/components/EmptyState';
import { Icon } from '../../../src/components/Icon';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { textStyle } from '../../../src/theme/typography';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';
import { getLocalDatabase } from '../../../src/queue/db';
import { loadChatSnapshot, type ChatMessageItem } from '../../../src/chat/query';
import { attachmentLabel, type ChatAttachment } from '../../../src/media/model';

type MediaEntry = { attachment: ChatAttachment; message: ChatMessageItem };

export default function ChatMediaScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const c = theme.colors;
  const { session } = useAuth();
  const { showToast } = useToast();
  const net = useNetState();
  const [deleteTarget, setDeleteTarget] = useState<MediaEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteLock = useRef(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId || !session?.user.id) return;
    let active = true;
    void getLocalDatabase().then((db) => loadChatSnapshot(db, chatId, session.user.id, { limit: 200 })).then((snapshot) => {
      if (active) setMessages(snapshot.messages.filter((message) => message.deletedAt === null));
    }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [chatId, session?.user.id]);

  const confirmDelete = async () => {
    if (!deleteTarget || deleteLock.current) return;
    if (!net.isConnected) { showToast({ ...actionToast('deleteAttachment', 'error'), message: strings.common.checkConnection }); return; }
    deleteLock.current = true;
    setDeleting(true);
    try {
      const result = await deleteChatAttachment(supabase, deleteTarget.attachment.mediaId);
      if (result.error) throw result.error;
      const mediaId = deleteTarget.attachment.mediaId;
      setMessages((current) => current.map((message) => ({ ...message, attachments: message.attachments.filter((attachment) => attachment.mediaId !== mediaId) })));
      setDeleteTarget(null);
      showToast(actionToast('deleteAttachment', 'success'));
      try {
        await createSqliteCacheStore(await getLocalDatabase()).upsertMedia(result.data);
        notifyCacheChange();
      } catch { /* The sequenced server tombstone will be reconciled by sync. */ }
    } catch {
      showToast(actionToast('deleteAttachment', 'error'));
    } finally { deleteLock.current = false; setDeleting(false); }
  };

  const entries = useMemo<MediaEntry[]>(() => messages.flatMap((message) => message.attachments.map((attachment) => ({ attachment, message }))).reverse(), [messages]);
  const groups = useMemo(() => {
    const grouped = new Map<MediaType, MediaEntry[]>();
    for (const entry of entries) {
      const current = grouped.get(entry.attachment.mediaType) ?? [];
      current.push(entry);
      grouped.set(entry.attachment.mediaType, current);
    }
    return [...grouped.entries()];
  }, [entries]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title={strings.chatInfo.mediaFilesLinks} onBack={() => goBackOrReplace(router, { pathname: '/chat/[chatId]/info', params: { chatId } })} />
      {loading ? <Text style={[textStyle(theme.typeTokens.bodyMd), styles.status, { color: c.text.secondary }]}>Loading shared items…</Text> : entries.length === 0 ? <EmptyState iconName="action.gallery" title="No shared items" message="Photos, videos, files and voice notes will appear here." /> : (
        <ScrollView>
          {groups.map(([type, items]) => <View key={type} style={styles.group}><Text style={[textStyle(theme.typeTokens.titleSm), styles.heading, { color: c.text.secondary }]}>{attachmentLabel(type)}</Text>{items.map((entry) => <MediaRow key={entry.attachment.mediaId} entry={entry} onDelete={entry.message.senderId === session?.user.id && !entry.message.pending ? () => setDeleteTarget(entry) : undefined} onPress={() => router.push({ pathname: '/chat/[chatId]/media/[mediaId]', params: { chatId, mediaId: entry.attachment.mediaId } })} />)}</View>)}
        </ScrollView>
      )}
      <Dialog visible={deleteTarget !== null} title={strings.toasts.attachmentDeleteTitle} message={strings.toasts.attachmentDeleteBody} confirmLabel={strings.chat.delete} destructive onConfirm={() => { if (!deleting) void confirmDelete(); }} onDismiss={() => { if (!deleteLock.current) setDeleteTarget(null); }} />
    </View>
  );
}

function MediaRow({ entry, onPress, onDelete }: { entry: MediaEntry; onPress: () => void; onDelete?: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const icon = entry.attachment.mediaType === 'photo' ? 'media.photo' : entry.attachment.mediaType === 'video' ? 'media.video' : entry.attachment.mediaType === 'voice' ? 'media.voice' : 'media.file';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}><Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.bg.pressed }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${attachmentLabel(entry.attachment.mediaType)}`}>
      <View style={[styles.icon, { backgroundColor: c.bg.surface }]}><Icon name={icon} size="md" color={c.text.primary} accessibilityLabel="" /></View>
      <View style={styles.body}><Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]}>{attachmentLabel(entry.attachment.mediaType)}</Text><Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]} numberOfLines={1}>{entry.message.content || 'Shared in chat'}</Text></View>
      <Icon name="nav.forward" size="sm" color={c.text.muted} accessibilityLabel="" />
    </Pressable>{onDelete ? <Button label={strings.chat.delete} variant="text" onPress={onDelete} /> : null}</View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  status: { padding: 20 },
  group: { paddingBottom: 8 },
  heading: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  row: { flex: 1, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
});
