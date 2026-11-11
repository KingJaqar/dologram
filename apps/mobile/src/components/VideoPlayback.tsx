import React, { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useEvent } from 'expo';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { registerPlaybackPause } from '../calls/audioOwnership';

export function VideoPlayback({ uri, onError }: { uri: string; onError: () => void }) {
  const player = useVideoPlayer(null);
  useEffect(() => {
    let alive = true;
    const position = player.currentTime;
    const playing = player.playing;
    void player.replaceAsync(uri).then(() => {
      if (!alive) return;
      player.currentTime = position;
      if (playing) player.play();
    }).catch(() => { if (alive) onError(); });
    return () => { alive = false; };
  }, [onError, player, uri]);
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  useEffect(() => { if (status === 'error') onError(); }, [onError, status]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state !== 'active') player.pause(); });
    return () => sub.remove();
  }, [player]);
  useFocusEffect(React.useCallback(() => () => { player.pause(); }, [player]));
  useEffect(() => registerPlaybackPause(() => player.pause()), [player]);
  return <View style={styles.container}><VideoView player={player} style={styles.video} contentFit="contain" nativeControls accessibilityLabel="Video playback" /></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, width: '100%' }, video: { width: '100%', height: '100%' } });
