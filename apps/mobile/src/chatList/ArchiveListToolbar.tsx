import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { conversationIdentity, markChatRead as persistChatRead, strings, type ChatListItem } from '@dologram/shared';
import { memoPreference } from '../memos/organization';
import { useAuth } from '../auth/AuthProvider';
import { markChatsRead } from '../chat/readState';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { useNetState } from '../net/netState';
import { getLocalDatabase } from '../queue/db';
import { notifyCacheChange } from '../sync/cacheEvents';
import { resyncChatNow } from '../sync/lifecycle';
import { useTheme } from '../theme/ThemeProvider';

/** Shared list toolbar so Archive and Ignored use the same read-all behavior. */
export function ArchiveListToolbar({ items, title = strings.chatList.archivedChats }: { items: readonly ChatListItem[]; title?: string }) {
  const { session } = useAuth();
  const net = useNetState();
  const theme = useTheme();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const unread = items.filter((item) => item.unreadCount > 0);

  const readAll = async () => {
    const userId = session?.user.id;
    if (!userId || lock.current || unread.length === 0) return;
    lock.current = true;
    setBusy(true);
    try {
      const db = await getLocalDatabase();
      await Promise.all(unread.filter((item) => conversationIdentity(item.chatId).kind === 'memo').map((item) => memoPreference(item.chatId, 'unread', false)));
      await markChatsRead(db, unread.filter((item) => conversationIdentity(item.chatId).kind === 'chat').map((item) => item.chatId), userId, net.isConnected,
        (chatId, seq, membershipJoinedAt, signal) => persistChatRead(supabase, chatId, seq, membershipJoinedAt, signal),
        async () => false,
        { onMembershipChanged: resyncChatNow });
      notifyCacheChange();
    } catch {
      showToast({ message: strings.chatList.readAllFailed });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={[styles.bar, { backgroundColor: theme.colors.bg.chatList, borderBottomColor: theme.colors.separator }]}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.colors.text.primary }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Button label={strings.chatList.readAll} variant="text" loading={busy} disabled={unread.length === 0} onPress={() => void readAll()} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 16, paddingRight: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, fontSize: 17, fontWeight: '600' },
});
