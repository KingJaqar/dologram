/**
 * Queue debug screen — dev tools only (EXPO_PUBLIC_DG_DEV_TOOLS === "1", D-160).
 *
 * Phase 5 device check: write a text item to the local queue, watch the foreground worker move it
 * through the LS-2 states, and use Retry and Discard (D-93). The chat screens of Phase 9 replace
 * this as the normal surface.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { config, strings, validateMessageText, type QueueItem } from '@dologram/shared';
import { useTheme } from '../../src/theme/ThemeProvider';
import { textStyle } from '../../src/theme/typography';
import { TopBar } from '../../src/components/TopBar';
import { goBackOrReplace } from '../../src/navigation/goBackOrReplace';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { useAuth } from '../../src/auth/AuthProvider';
import { useNetState } from '../../src/net/netState';
import {
  discardQueueItem,
  enqueueTextMessage,
  getUnsentItems,
  retryQueueItem,
} from '../../src/queue/localQueue';

function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString();
}

export default function QueueDebugScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const net = useNetState();
  const c = theme.colors;

  const [items, setItems] = useState<QueueItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatId, setChatId] = useState('');
  const [content, setContent] = useState('');

  const refresh = useCallback(async () => {
    try {
      const pending = await getUnsentItems();
      setItems(pending);
      setLoadError(null);
    } catch {
      setLoadError(strings.common.couldNotLoad);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getUnsentItems()
      .then((pending) => {
        if (!active) return;
        setItems(pending);
        setLoadError(null);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(strings.common.couldNotLoad);
      });
    return () => {
      active = false;
    };
  }, []);

  if (process.env.EXPO_PUBLIC_DG_DEV_TOOLS !== '1') {
    return <Redirect href="/(main)/(tabs)" />;
  }

  async function handleEnqueue() {
    setNotice(null);
    if (!session) {
      setNotice('Sign in first: the sender id comes from the session.');
      return;
    }
    const trimmedChatId = chatId.trim();
    if (trimmedChatId === '') {
      setNotice('Enter the chat id the message will be sent to.');
      return;
    }
    const validation = validateMessageText(content, 0);
    if (!validation.ok) {
      setNotice(validation.reason === 'blank' ? 'Enter some text.' : 'The text is too long.');
      return;
    }

    try {
      const result = await enqueueTextMessage({
        chatId: trimmedChatId,
        senderId: session.user.id,
        content,
      });
      setNotice(result.ok ? 'Queued.' : strings.queue.full);
      if (result.ok) {
        setContent('');
        await refresh();
      }
    } catch {
      setLoadError(strings.common.couldNotLoad);
    }
  }

  async function handleRetry(tempId: string) {
    setNotice(null);
    try {
      const result = await retryQueueItem(tempId);
      setNotice(result.ok ? null : 'Only a failed item can be retried.');
      await refresh();
    } catch {
      setLoadError(strings.common.couldNotLoad);
    }
  }

  async function handleDiscard(tempId: string) {
    setNotice(null);
    try {
      const result = await discardQueueItem(tempId, net.isConnected);
      if (!result.ok) {
        setNotice(
          result.reason === 'offline'
            ? strings.common.noConnection
            : strings.common.checkConnection,
        );
      }
      await refresh();
    } catch {
      setLoadError(strings.common.couldNotLoad);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title="Queue debug" onBack={() => goBackOrReplace(router, '/(main)/(tabs)/settings')} />

      <ScrollView contentContainerStyle={[styles.body, { padding: theme.space[4], gap: theme.space[4] }]}>
        <Text
          style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}
          maxFontSizeMultiplier={1.5}
        >
          {`${session ? `user ${session.user.id}` : 'signed out'} · ${net.isConnected ? 'online' : 'offline'}`}
        </Text>

        <TextField
          label="Chat id"
          value={chatId}
          onChangeText={setChatId}
          placeholder="chat uuid"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField
          label="Text"
          value={content}
          onChangeText={setContent}
          placeholder="Message text"
          multiline
          style={styles.textArea}
        />
        <Button label="Enqueue text" fullWidth onPress={handleEnqueue} disabled={!net.isConnected} />

        <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
          <Button label="Refresh" variant="secondary" onPress={() => void refresh()} />
        </View>

        {notice ? (
          <Text
            style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}
            maxFontSizeMultiplier={1.5}
          >
            {notice}
          </Text>
        ) : null}

        {loadError ? (
          <Text
            style={[textStyle(theme.typeTokens.bodySm), { color: c.error.text }]}
            maxFontSizeMultiplier={1.5}
          >
            {loadError}
          </Text>
        ) : null}

        <Text
          style={[textStyle(theme.typeTokens.labelMd), { color: c.text.primary }]}
          maxFontSizeMultiplier={1.5}
        >
          {`Unsent items: ${items.length}`}
        </Text>

        {items.map((item) => (
          <View
            key={item.temp_id}
            style={[
              styles.card,
              {
                backgroundColor: c.bg.surface,
                borderColor: c.separator,
                borderRadius: theme.radius.md,
                padding: theme.space[3],
                gap: theme.space[2],
              },
            ]}
          >
            <Text
              style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.primary }]}
              numberOfLines={2}
            >
              {item.payload.content}
            </Text>
            <Text
              style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}
              maxFontSizeMultiplier={1.5}
            >
              {`${item.chat_id} · ${item.status} · attempt ${item.retry_count}/${config.queue.maxAttempts}`}
            </Text>
            <Text
              style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}
              maxFontSizeMultiplier={1.5}
            >
              {`next attempt ${formatTime(item.next_attempt_at)}${item.last_error ? ` · last error ${item.last_error}` : ''}`}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
              {item.status === 'failed' ? (
                <Button label="Retry" variant="text" onPress={() => void handleRetry(item.temp_id)} />
              ) : null}
              <Button
                label="Discard"
                variant="text"
                onPress={() => void handleDiscard(item.temp_id)}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingBottom: 48 },
  textArea: { height: 96, paddingTop: 12, textAlignVertical: 'top' },
  card: { borderWidth: StyleSheet.hairlineWidth },
});
