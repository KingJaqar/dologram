import React, { useEffect, useRef } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { strings } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Button } from './Button';
import { DelayedActivityIndicator } from './DelayedActivityIndicator';
import { isCallAudioOwned, registerPlaybackPause } from '../calls/audioOwnership';

function time(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function VoiceNotePlayer({ uri, onError }: { uri: string; onError: () => void }) {
  const theme = useTheme();
  const player = useAudioPlayer(null);
  const restore = useRef<{ position: number; playing: boolean; speed: number } | null>(null);
  useEffect(() => {
    restore.current = { position: player.currentTime, playing: player.playing, speed: player.playbackRate };
    try { player.replace(uri); } catch { onError(); }
  }, [onError, player, uri]);
  useEffect(() => {
    let alive = true;
    const sub = player.addListener('playbackStatusUpdate', (next) => {
      const previous = restore.current;
      if (!next.isLoaded || !previous) return;
      restore.current = null;
      void player.seekTo(previous.position).then(() => {
        if (!alive) return;
        player.setPlaybackRate(previous.speed);
        if (previous.playing) player.play();
      }).catch(onError);
    });
    return () => { alive = false; sub.remove(); };
  }, [onError, player]);
  const status = useAudioPlayerStatus(player);
  useEffect(() => { if (status.error) onError(); }, [onError, status.error]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state !== 'active') player.pause(); });
    return () => sub.remove();
  }, [player]);
  useFocusEffect(React.useCallback(() => () => { player.pause(); }, [player]));
  useEffect(() => registerPlaybackPause(() => player.pause()), [player]);
  const play = async () => {
    try {
      if (isCallAudioOwned()) return;
      if (status.playing) player.pause();
      else {
        if (status.didJustFinish || status.duration > 0 && status.currentTime >= status.duration) await player.seekTo(0);
        player.play();
      }
    } catch { onError(); }
  };
  return <View style={styles.row}>
    {!status.isLoaded || status.isBuffering ? <DelayedActivityIndicator active={!status.isLoaded || status.isBuffering} color={theme.colors.brand.primary} accessibilityLabel="Loading voice note" /> : null}
    <View style={styles.controls}>
      <Button label={status.playing ? strings.media.pause : strings.media.play} variant="text" onPress={() => void play()} disabled={!status.isLoaded} />
      <Button label={status.playbackRate === 2 ? '2x' : '1x'} accessibilityLabel="Change voice note speed" variant="text" onPress={() => { try { player.setPlaybackRate(status.playbackRate === 2 ? 1 : 2); } catch { onError(); } }} />
    </View>
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: status.duration || 1, now: Math.min(status.currentTime, status.duration || 1) }} style={[styles.track, { backgroundColor: theme.colors.separator }]}>
      <View style={[styles.progress, { backgroundColor: theme.colors.brand.primary, width: `${status.duration > 0 ? Math.min(100, status.currentTime / status.duration * 100) : 0}%` }]} />
    </View>
    <Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.text.secondary }]}>{time(status.currentTime)} / {time(status.duration)}</Text>
    <Button label={strings.media.restart} variant="text" disabled={!status.isLoaded} onPress={() => { void player.seekTo(0).catch(onError); }} />
  </View>;
}
const styles = StyleSheet.create({ row: { width: 240, maxWidth: '100%', gap: 4 }, controls: { flexDirection: 'row', flexWrap: 'wrap' }, track: { height: 4, borderRadius: 2 }, progress: { height: 4, borderRadius: 2 } });
