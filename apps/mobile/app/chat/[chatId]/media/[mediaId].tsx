/** AND-09: member cache reads and authenticated Storage URLs. */
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { strings } from '@dologram/shared';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { TopBar } from '../../../../src/components/TopBar';
import { goBackOrReplace } from '../../../../src/navigation/goBackOrReplace';
import { textStyle } from '../../../../src/theme/typography';
import { useAuth } from '../../../../src/auth/AuthProvider';
import { Button } from '../../../../src/components/Button';
import { PhotoViewer } from '../../../../src/components/PhotoViewer';
import { VideoPlayback } from '../../../../src/components/VideoPlayback';
import { VoiceNotePlayer } from '../../../../src/components/VoiceNotePlayer';
import { getLocalDatabase } from '../../../../src/queue/db';
import { subscribeCacheChange } from '../../../../src/sync/cacheEvents';
import { loadMediaAttachment } from '../../../../src/media/query';
import type { ChatAttachment } from '../../../../src/media/model';
import { useMediaSource } from '../../../../src/media/useMediaSource';
import { shareMediaFile } from '../../../../src/media/shareFile';
import { DelayedActivityIndicator } from '../../../../src/components/DelayedActivityIndicator';
import { useDelayedFlag } from '../../../../src/hooks/useDelayedFlag';

function MediaContent({ attachment }: { attachment: ChatAttachment }) {
  const theme = useTheme();
  const source = useMediaSource(attachment);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const share = async () => {
    if (!source.uri || sharing) return;
    setSharing(true);
    setError(null);
    try { await shareMediaFile(attachment, source.uri, source.mime); }
    catch (failure) { setError(failure instanceof Error ? failure.message : strings.common.couldNotLoad); }
    finally { setSharing(false); }
  };
  if (source.error) return <Button label={source.error} variant="text" onPress={source.retry} />;
  if (!source.uri || source.loading) return <DelayedActivityIndicator active={!source.uri || source.loading} color={theme.colors.brand.primary} accessibilityLabel="Loading media" />;
  if (attachment.mediaType === 'photo') return <PhotoViewer uri={source.uri} onError={source.fail} />;
  if (attachment.mediaType === 'video') return <VideoPlayback uri={source.uri} onError={source.fail} />;
  if (attachment.mediaType === 'voice') return <VoiceNotePlayer uri={source.uri} onError={source.fail} />;
  return <View><Button label={strings.media.openFile} onPress={() => void share()} loading={sharing} />{error ? <Text style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.error.text }]}>{error}</Text> : null}</View>;
}

export default function MediaViewerScreen() {
  const params = useLocalSearchParams<{ chatId?: string; mediaId?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const chatId = typeof params.chatId === 'string' ? params.chatId : '';
  const mediaId = typeof params.mediaId === 'string' ? params.mediaId : '';
  const theme = useTheme();
  const router = useRouter();
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const showLoading = useDelayedFlag(attachment === null && error === null);
  const reloadRef = React.useRef<() => void>(() => {});
  useFocusEffect(useCallback(() => {
    let alive = true;
    async function load() {
      try {
        if (!userId || !chatId || !mediaId) throw new Error(strings.media.unavailable);
        const db = await getLocalDatabase();
        const media = await loadMediaAttachment(db, chatId, mediaId, userId);
        if (alive) { setAttachment(media); setError(null); }
      } catch {
        if (alive) { setAttachment(null); setError(strings.media.unavailable); }
      }
    }
    void Promise.resolve().then(load);
    reloadRef.current = () => { void load(); };
    const unsubscribe = subscribeCacheChange(() => { void load(); });
    return () => { alive = false; reloadRef.current = () => {}; unsubscribe(); };
  }, [chatId, mediaId, userId]));
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <TopBar title={strings.media.title} onBack={() => goBackOrReplace(router, chatId ? { pathname: '/chat/[chatId]', params: { chatId } } : '/(main)/(tabs)')} />
      <View style={styles.body}>
        {error ? <View><Text style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.error.text }]}>{error}</Text><Button label={strings.common.retry} variant="text" onPress={() => { setError(null); reloadRef.current(); }} /></View>
          : attachment ? <MediaContent key={attachment.mediaId} attachment={attachment} /> : showLoading ? <DelayedActivityIndicator color={theme.colors.brand.primary} accessibilityLabel="Loading media" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
