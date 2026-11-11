import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { strings } from '@dologram/shared';
import { Avatar } from '../../../src/components/Avatar';
import { Button } from '../../../src/components/Button';
import { ErrorState } from '../../../src/components/EmptyState';
import { SkeletonRow } from '../../../src/components/Skeleton';
import { TopBar } from '../../../src/components/TopBar';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useChatInfo } from '../../../src/chats/useChatInfo';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { textStyle } from '../../../src/theme/typography';
import { useDelayedFlag } from '../../../src/hooks/useDelayedFlag';
import { loadChatInfoSource } from '../../../src/chats/infoQuery';
import { getLocalDatabase } from '../../../src/queue/db';

export default function ChatProfileScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const c = theme.colors;
  const { session } = useAuth();
  const { info, loading, error, refresh } = useChatInfo(chatId);
  const showLoading = useDelayedFlag(loading);
  const [username, setUsername] = React.useState<string>('');

  React.useEffect(() => {
    if (!chatId) return;
    let active = true;
    void getLocalDatabase().then((db) => loadChatInfoSource(db, chatId)).then((source) => {
      if (!active || !info || info.isGroup) return;
      const other = source.profiles.find((profile) => profile.user_id === info.avatarId);
      setUsername(other?.username ?? '');
    }).catch(() => undefined);
    return () => { active = false; };
  }, [chatId, info]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title={strings.chatInfo.profile} onBack={() => goBackOrReplace(router, chatId ? { pathname: '/chat/[chatId]/info', params: { chatId } } : '/(main)/(tabs)')} />
      {loading ? (showLoading ? <View><SkeletonRow /><SkeletonRow /></View> : null) : info === null ? <ErrorState title={strings.chatInfo.unavailable} message={error ? strings.common.checkConnection : strings.chatInfo.unavailableBody} onRetry={() => void refresh()} /> : (
        <ScrollView contentContainerStyle={[styles.content, { padding: theme.space[6] }]}>
          <Avatar id={info.avatarId} displayName={info.title} imageUrl={info.avatarUrl} size={96} isSavedMessages={info.savedMessages} />
          <Text style={[textStyle(theme.typeTokens.titleLg), { color: c.text.primary, textAlign: 'center' }]}>{info.title}</Text>
          {username ? <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.secondary }]}>@{username}</Text> : null}
          {info.isGroup ? <Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]}>{info.subtitle}</Text> : null}
          <View style={[styles.card, { backgroundColor: c.bg.surface }]}>
            <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>{info.isGroup ? 'Group members' : 'Chat member'}</Text>
            {info.isGroup ? info.members.map((member) => (
              <Text key={member.userId} style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]}>
                {member.displayName}{member.isSelf ? ' (You)' : ''}{member.roleLabel ? ` · ${member.roleLabel}` : ''}
              </Text>
            )) : <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]}>{session?.user.id === info.avatarId ? 'You' : info.title}</Text>}
          </View>
          <Button label={info.isGroup ? 'Open group chat' : 'Message'} fullWidth onPress={() => router.dismissTo({ pathname: '/chat/[chatId]', params: { chatId } })} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignItems: 'center', gap: 12 },
  card: { width: '100%', marginTop: 20, padding: 16, borderRadius: 16, gap: 4 },
});
