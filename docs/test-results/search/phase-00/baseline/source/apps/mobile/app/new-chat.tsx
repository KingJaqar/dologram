/**
 * AND-10: New chat (M2-07, D-42, D-46, D-70, D-88).
 *
 * An exact-username field with Find, one result (48 avatar, display name) and Message. Message opens
 * the existing direct chat or creates it (D-70). find_user returns only user_id and display_name
 * (D-88) and the 31st lookup within a minute is refused with DG429 (D-46). Offline, Find is disabled
 * with "No connection" (12.5).
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  dgTrim,
  findUser,
  strings,
  type FindUserRow,
} from '@dologram/shared';
import { TopBar } from '../src/components/TopBar';
import { goBackOrReplace } from '../src/navigation/goBackOrReplace';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { Avatar } from '../src/components/Avatar';
import { useToast } from '../src/components/Toast';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useAuth } from '../src/auth/AuthProvider';
import { useNetState } from '../src/net/netState';
import { supabase } from '../src/lib/supabase';
import { ids } from '../src/lib/ids';
import { getLocalDatabase } from '../src/queue/db';
import { openDirectChat } from '../src/chats/directChat';
import { searchErrorMessage } from '../src/chats/errors';

type SearchState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'found'; user: FindUserRow }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

export default function NewChatScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const net = useNetState();
  const { session } = useAuth();
  const { showToast } = useToast();
  const userId = session?.user.id ?? null;

  const [username, setUsername] = useState('');
  const [search, setSearch] = useState<SearchState>({ status: 'idle' });
  const [opening, setOpening] = useState(false);

  const trimmed = dgTrim(username);
  const searching = search.status === 'searching';
  const canFind = net.isConnected && trimmed.length > 0 && !searching && !opening;

  const onFind = useCallback(async () => {
    if (!canFind) return;
    setSearch({ status: 'searching' });
    const { data, error } = await findUser(supabase, trimmed);
    if (error) {
      setSearch({ status: 'error', message: searchErrorMessage(error) });
      return;
    }
    const found = data[0] ?? null;
    setSearch(found === null ? { status: 'notFound' } : { status: 'found', user: found });
  }, [canFind, trimmed]);

  const onMessage = useCallback(
    async (user: FindUserRow) => {
      if (!userId || opening) return;
      setOpening(true);
      try {
        const db = await getLocalDatabase();
        const outcome = await openDirectChat({
          client: supabase,
          db,
          userId,
          otherUserId: user.user_id,
          newChatId: ids.chatId(),
        });
        if (outcome.kind === 'failed') {
          showToast({ message: outcome.message });
          return;
        }
        router.replace({ pathname: '/chat/[chatId]', params: { chatId: outcome.chatId } });
      } catch {
        showToast({ message: strings.newChat.openFailed });
      } finally {
        setOpening(false);
      }
    },
    [userId, opening, router, showToast],
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title={strings.newChat.title} onBack={() => goBackOrReplace(router)} />

      <ScrollView
        contentContainerStyle={[styles.body, { padding: theme.space[4], gap: theme.space[4] }]}
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          label={strings.newChat.usernameLabel}
          helper={strings.newChat.usernameHelper}
          value={username}
          onChangeText={(next) => {
            setUsername(next);
            setSearch({ status: 'idle' });
          }}
          onSubmitEditing={() => void onFind()}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          editable={!opening}
        />

        <Button
          label={strings.newChat.find}
          onPress={() => void onFind()}
          disabled={!canFind}
          loading={searching}
        />

        {net.isConnected ? null : (
          <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>
            {strings.common.noConnection}
          </Text>
        )}

        {search.status === 'notFound' ? (
          <Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]}>
            {strings.newChat.notFound}
          </Text>
        ) : null}

        {search.status === 'error' ? (
          <Text
            style={[textStyle(theme.typeTokens.bodyMd), { color: c.error.text }]}
            accessibilityRole="alert"
          >
            {search.message}
          </Text>
        ) : null}

        {search.status === 'found' ? (
          <View
            style={[
              styles.resultRow,
              {
                backgroundColor: c.bg.surface,
                borderRadius: theme.radius.md,
                padding: theme.space[4],
                gap: theme.space[3],
              },
            ]}
          >
            <Avatar id={search.user.user_id} displayName={search.user.display_name} size={48} />
            <Text
              style={[textStyle(theme.typeTokens.bodyLg), styles.resultName, { color: c.text.primary }]}
              numberOfLines={1}
            >
              {search.user.display_name}
            </Text>
            <Button
              label={strings.newChat.message}
              onPress={() => void onMessage(search.user)}
              loading={opening}
              disabled={opening}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flexGrow: 1 },
  resultRow: { flexDirection: 'row', alignItems: 'center' },
  resultName: { flex: 1 },
});
