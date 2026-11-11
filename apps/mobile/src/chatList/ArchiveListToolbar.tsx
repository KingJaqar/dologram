import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { strings, updateOwnMember, type ChatListItem } from '@dologram/shared';
import { useAuth } from '../auth/AuthProvider';
import { markChatsRead } from '../chat/readState';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { useNetState } from '../net/netState';
import { getLocalDatabase } from '../queue/db';
import { notifyCacheChange } from '../sync/cacheEvents';
import { useTheme } from '../theme/ThemeProvider';

/** This belongs to the archive scene so changing sections cannot resize the shared header. */
export function ArchiveListToolbar({ items }: { items: readonly ChatListItem[] }) {
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
      await markChatsRead(db, unread.map((item) => item.chatId), userId, net.isConnected,
        (chatId, seq) => updateOwnMember(supabase, chatId, userId, { last_read_seq: seq }),
        async () => false);
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
        {strings.chatList.archivedChats}
      </Text>
      <Button label={strings.chatList.readAll} variant="text" loading={busy} disabled={unread.length === 0} onPress={() => void readAll()} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 16, paddingRight: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, fontSize: 17, fontWeight: '600' },
});
