import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { dgTrim, strings, updateChatTitle, validateGroupTitle } from '@dologram/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../../src/components/Button';
import { TextField } from '../../../src/components/TextField';
import { TopBar } from '../../../src/components/TopBar';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { textStyle } from '../../../src/theme/typography';
import { useToast } from '../../../src/components/Toast';
import { actionToast } from '../../../src/notifications/toastCopy';
import { useChatInfo } from '../../../src/chats/useChatInfo';
import { useNetState } from '../../../src/net/netState';
import { supabase } from '../../../src/lib/supabase';
import { getLocalDatabase } from '../../../src/queue/db';
import { createSqliteCacheStore } from '../../../src/sync/cacheStore';
import { notifyCacheChange } from '../../../src/sync/cacheEvents';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';

export default function GroupNameScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();
  const net = useNetState();
  const { info, loading } = useChatInfo(chatId);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  useEffect(() => {
    if (info?.isGroup) setTitle(info.title);
  }, [info?.isGroup, info?.title]);

  const save = async () => {
    const nextTitle = dgTrim(title);
    if (!chatId || !info?.isGroup || !info.isOwner || loading || saving || saveLock.current || !net.isConnected || !validateGroupTitle(nextTitle)) return;
    saveLock.current = true;
    setSaving(true);
    try {
      const result = await updateChatTitle(supabase, chatId, nextTitle);
      if (result.error || !result.data) throw new Error('group_name_update_failed');
      const db = await getLocalDatabase();
      await createSqliteCacheStore(db).upsertChat(result.data);
      notifyCacheChange();
      showToast(actionToast('renameGroup', 'success'));
      goBackOrReplace(router, { pathname: '/chat/[chatId]/info', params: { chatId } });
    } catch {
      showToast(actionToast('renameGroup', 'error'));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title={strings.chatInfo.groupName} onBack={() => goBackOrReplace(router, { pathname: '/chat/[chatId]/info', params: { chatId } })} />
      <ScrollView contentContainerStyle={[styles.content, { padding: theme.space[5] }]} keyboardShouldPersistTaps="handled">
        <Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]}>This is the shared name for the whole group conversation. It is separate from member nicknames.</Text>
        <TextField label={strings.newGroup.titleLabel} value={title} onChangeText={setTitle} maxLength={64} editable={!loading && !saving} autoCapitalize="words" autoCorrect={false} />
        <Button label="Save" fullWidth loading={saving || loading} disabled={loading || !info?.isOwner || !net.isConnected || !validateGroupTitle(dgTrim(title))} onPress={() => void save()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 20 },
});
