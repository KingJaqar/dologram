import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { setChatNickname, strings } from '@dologram/shared';
import { Button } from '../../../src/components/Button';
import { TextField } from '../../../src/components/TextField';
import { TopBar } from '../../../src/components/TopBar';
import { useAuth } from '../../../src/auth/AuthProvider';
import { actionToast } from '../../../src/notifications/toastCopy';
import { useToast } from '../../../src/components/Toast';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { textStyle } from '../../../src/theme/typography';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';
import { useChatInfo } from '../../../src/chats/useChatInfo';
import { useNetState } from '../../../src/net/netState';
import { supabase } from '../../../src/lib/supabase';
import { getLocalDatabase } from '../../../src/queue/db';
import { cacheMembers } from '../../../src/chat/readState';
import { notifyCacheChange } from '../../../src/sync/cacheEvents';
import { loadChatPreferences, updateChatPreferences } from '../../../src/chats/preferences';

export default function ChatNicknamesScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const c = theme.colors;
  const { session } = useAuth();
  const { showToast } = useToast();
  const net = useNetState();
  const { info, loading } = useChatInfo(chatId);
  const members = info?.members ?? [];
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [originalNickname, setOriginalNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const legacyLocalOnly = typeof (supabase as unknown as { rpc?: unknown }).rpc !== 'function';
  const selectedMember = useMemo(() => members.find((member) => member.userId === selectedMemberId) ?? null, [members, selectedMemberId]);

  useEffect(() => {
    if (selectedMemberId === null && members.length > 0) setSelectedMemberId(members[0]?.userId ?? null);
  }, [members, selectedMemberId]);

  useEffect(() => {
    if (!selectedMember) return;
    if (legacyLocalOnly && session?.user.id && chatId) {
      void loadChatPreferences(session.user.id, chatId).then((preferences) => { setNickname(preferences.nickname); setOriginalNickname(preferences.nickname); }).catch(() => showToast({ message: strings.chatInfo.preferenceFailed, variant: 'error' }));
      return;
    }
    const next = selectedMember.nickname ?? '';
    setNickname(next);
    setOriginalNickname(next);
  }, [chatId, legacyLocalOnly, selectedMember?.nickname, selectedMemberId, session?.user.id, showToast]);

  const save = async () => {
    if (!chatId || !selectedMemberId || loading || saving || saveLock.current || !net.isConnected) return;
    const nextNickname = nickname.trim();
    const feedback = !nextNickname ? 'removeNickname' : originalNickname ? 'changeNickname' : 'setNickname';
    saveLock.current = true;
    setSaving(true);
    try {
      if (legacyLocalOnly && session?.user.id) {
        await updateChatPreferences(session.user.id, chatId, { nickname: nextNickname });
      } else {
        const result = await setChatNickname(supabase, chatId, selectedMemberId, nextNickname || null);
        if (result.error || !result.data) throw new Error('nickname_update_failed');
        const db = await getLocalDatabase();
        await cacheMembers(db, [result.data]);
        notifyCacheChange();
      }
      showToast(actionToast(feedback, 'success'));
      goBackOrReplace(router, { pathname: '/chat/[chatId]/info', params: { chatId } });
    } catch {
      showToast(actionToast(feedback, 'error'));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title={strings.chatInfo.nicknames} onBack={() => goBackOrReplace(router, { pathname: '/chat/[chatId]/info', params: { chatId } })} />
      <ScrollView contentContainerStyle={[styles.content, { padding: theme.space[5] }]} keyboardShouldPersistTaps="handled">
        <Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]}>Nicknames are shared with everyone in this chat and only apply here. They do not change anyone’s profile name.</Text>
        <View style={styles.memberList}>
          {members.map((member) => (
            <Pressable key={member.userId} onPress={() => setSelectedMemberId(member.userId)} accessibilityRole="button" accessibilityLabel={`Edit nickname for ${member.displayName}`} style={({ pressed }) => [styles.memberChoice, { borderColor: selectedMemberId === member.userId ? c.brand.primary : c.separator, backgroundColor: pressed ? c.bg.pressed : c.bg.surface }]}>
              <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]} numberOfLines={1}>{member.profileDisplayName ?? member.displayName}{member.isSelf ? ' (you)' : ''}</Text>
              {member.nickname ? <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]} numberOfLines={1}>{member.nickname}</Text> : <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]} numberOfLines={1}>No nickname</Text>}
            </Pressable>
          ))}
        </View>
        <TextField
          label="Nickname"
          value={nickname}
          onChangeText={setNickname}
          placeholder={selectedMember ? strings.chatInfo.setNicknameFor(selectedMember.username ? `@${selectedMember.username}` : selectedMember.displayName) : undefined}
          maxLength={64}
          editable={!loading && !saving && selectedMember !== null}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <Button label="Save" fullWidth loading={saving || loading} disabled={loading || selectedMember === null || !net.isConnected} onPress={() => void save()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 20 },
  memberList: { gap: 8 },
  memberChoice: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
});
