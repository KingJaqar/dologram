/**
 * Sync debug screen — dev tools only (EXPO_PUBLIC_DG_DEV_TOOLS === "1", D-160).
 *
 * Phase 6 device check: shows the cursor and the cached rows of every chat the sync engine holds,
 * and runs a catch-up pass. Phase 7 renders the same cache as the chat list.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { strings } from '@dologram/shared';
import { useTheme } from '../../src/theme/ThemeProvider';
import { textStyle } from '../../src/theme/typography';
import { TopBar } from '../../src/components/TopBar';
import { goBackOrReplace } from '../../src/navigation/goBackOrReplace';
import { Button } from '../../src/components/Button';
import { useNetState } from '../../src/net/netState';
import {
  getSyncStatus,
  resyncNow,
  subscribeSyncStatus,
  type SyncStatus,
} from '../../src/sync/lifecycle';
import { readSyncDebugSnapshot, type SyncDebugSnapshot } from '../../src/sync/debug';

export default function SyncDebugScreen() {
  const theme = useTheme();
  const router = useRouter();
  const net = useNetState();
  const c = theme.colors;

  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [snapshot, setSnapshot] = useState<SyncDebugSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await readSyncDebugSnapshot());
      setLoadError(null);
    } catch {
      setLoadError(strings.common.couldNotLoad);
    }
  }, []);

  useEffect(() => subscribeSyncStatus(setStatus), []);

  useEffect(() => {
    let active = true;
    readSyncDebugSnapshot()
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
        setLoadError(null);
      })
      .catch(() => {
        if (active) setLoadError(strings.common.couldNotLoad);
      });
    return () => {
      active = false;
    };
  }, [status.state]);

  if (process.env.EXPO_PUBLIC_DG_DEV_TOOLS !== '1') {
    return <Redirect href="/(main)/(tabs)" />;
  }

  async function handleResync() {
    await resyncNow();
    await refresh();
  }

  const summary = status.summary;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title="Sync debug" onBack={() => goBackOrReplace(router, '/(main)/(tabs)/settings')} />

      <ScrollView
        contentContainerStyle={[styles.body, { padding: theme.space[4], gap: theme.space[3] }]}
      >
        <Text
          style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}
          maxFontSizeMultiplier={1.5}
        >
          {`sync: ${status.state} · ${net.isConnected ? 'online' : 'offline'}`}
        </Text>

        {summary ? (
          <Text
            style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}
            maxFontSizeMultiplier={1.5}
          >
            {`${summary.chats} chats · ${summary.pruned} pruned · ${summary.failed} failed`}
          </Text>
        ) : null}

        <Button
          label="Resync now"
          fullWidth
          onPress={() => void handleResync()}
          disabled={!net.isConnected || status.state === 'syncing'}
        />
        <Button label="Refresh" variant="secondary" fullWidth onPress={() => void refresh()} />

        {loadError ? (
          <Text
            style={[textStyle(theme.typeTokens.bodySm), { color: c.error.text }]}
            maxFontSizeMultiplier={1.5}
          >
            {loadError}
          </Text>
        ) : null}

        {snapshot ? (
          <>
            <Text
              style={[textStyle(theme.typeTokens.labelMd), { color: c.text.primary }]}
              maxFontSizeMultiplier={1.5}
            >
              {`Cached: ${snapshot.chats} chats · ${snapshot.members} members`}
            </Text>
            <Text
              style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}
              maxFontSizeMultiplier={1.5}
            >
              {`${snapshot.messages} messages · ${snapshot.media} media · ${snapshot.reactions} reactions`}
            </Text>

            {snapshot.cursors.length === 0 ? (
              <Text
                style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}
                maxFontSizeMultiplier={1.5}
              >
                No chat synced yet.
              </Text>
            ) : (
              snapshot.cursors.map((entry) => (
                <View
                  key={entry.chatId}
                  style={[
                    styles.card,
                    {
                      backgroundColor: c.bg.surface,
                      borderColor: c.separator,
                      borderRadius: theme.radius.md,
                      padding: theme.space[3],
                    },
                  ]}
                >
                  <Text
                    style={[textStyle(theme.typeTokens.bodySm), { color: c.text.primary }]}
                    numberOfLines={1}
                  >
                    {entry.chatId}
                  </Text>
                  <Text
                    style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}
                    maxFontSizeMultiplier={1.5}
                  >
                    {`cursor ${entry.cursor}`}
                  </Text>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingBottom: 48 },
  card: { borderWidth: StyleSheet.hairlineWidth },
});
