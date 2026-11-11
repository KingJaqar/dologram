import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { strings, updateOwnMember } from '@dologram/shared';
import { TopBar } from '../../../src/components/TopBar';
import { SwitchRow } from '../../../src/components/SwitchRow';
import { useAuth } from '../../../src/auth/AuthProvider';
import { supabase } from '../../../src/lib/supabase';
import { actionToast } from '../../../src/notifications/toastCopy';
import { useToast } from '../../../src/components/Toast';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { textStyle } from '../../../src/theme/typography';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';
import { loadChatPreferences, updateChatPreferences } from '../../../src/chats/preferences';
import { useNetState } from '../../../src/net/netState';

const MUTED_FOREVER = '9999-12-31T23:59:59.999Z';

export default function ChatNotificationsScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const c = theme.colors;
  const { session } = useAuth();
  const { showToast } = useToast();
  const net = useNetState();
  const [notifications, setNotifications] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (!chatId || !session?.user.id) return;
    let active = true;
    void Promise.all([
      loadChatPreferences(session.user.id, chatId),
      supabase.from('chat_members').select('muted_until').eq('chat_id', chatId).eq('user_id', session.user.id).single(),
    ]).then(([preferences, member]) => {
      if (member.error) throw member.error;
      if (!active) return;
      const until = member.data.muted_until;
      setNotifications(!until || (until !== 'infinity' && Date.parse(until) <= Date.now()));
      setSounds(preferences.sounds);
    }).catch(() => { if (active) showToast({ message: strings.chatInfo.preferenceFailed, variant: 'error' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [chatId, session?.user.id, showToast]);

  const change = async (patch: { notifications?: boolean; sounds?: boolean }) => {
    if (!chatId || !session?.user.id || !net.isConnected || lock.current) return;
    lock.current = true;
    setSaving(true);
    const feedback = patch.notifications ? 'enableNotifications' : 'disableNotifications';
    try {
      if (patch.notifications !== undefined) {
        const result = await updateOwnMember(supabase, chatId, session.user.id, { muted_until: patch.notifications ? null : MUTED_FOREVER });
        if (result.error) throw result.error;
        // Server membership is canonical. A device cache write cannot undo a confirmed change.
        await updateChatPreferences(session.user.id, chatId, patch).catch(() => undefined);
        setNotifications(patch.notifications);
        showToast(actionToast(feedback, 'success'));
      } else {
        await updateChatPreferences(session.user.id, chatId, patch);
      }
      if (patch.sounds !== undefined) setSounds(patch.sounds);
    } catch {
      showToast(patch.notifications !== undefined ? actionToast(feedback, 'error') : { message: strings.chatInfo.preferenceFailed, variant: 'error' });
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title={strings.chatInfo.notifications} onBack={() => goBackOrReplace(router, { pathname: '/chat/[chatId]/info', params: { chatId } })} />
      <ScrollView contentContainerStyle={[styles.content, { padding: theme.space[5] }]}>
        <Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]}>Control alerts for this conversation. These settings are private to this device.</Text>
        <SwitchRow label="Notifications" description="Show notifications for new messages" value={notifications} onValueChange={(value) => void change({ notifications: value })} disabled={loading || saving || !net.isConnected} />
        <SwitchRow label="Sounds" description="Play a sound with notifications" value={sounds} onValueChange={(value) => void change({ sounds: value })} disabled={loading || saving || !notifications || !net.isConnected} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 8 },
});
