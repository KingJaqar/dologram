import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import { config, strings } from '@dologram/shared';
import { ids } from '../lib/ids';
import { attachmentRefusal, type DraftAttachment } from '../media/model';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';
import { isCallAudioOwned, registerRecorderStop } from '../calls/audioOwnership';

export function VoiceRecordButton({ onRecorded, onError, disabled }: {
  onRecorded: (attachment: DraftAttachment) => void; onError: (message: string) => void; disabled: boolean;
}) {
  const theme = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const held = useRef(false);
  const preparing = useRef(false);
  const stopping = useRef(false);
  const discard = useRef(false);
  const capture = useRef(false);
  const preparationPromise = useRef<Promise<void> | null>(null);
  const finishRef = useRef<(cancel: boolean) => Promise<void>>(async () => {});

  async function finish(cancel: boolean) {
    held.current = false;
    discard.current ||= cancel;
    if (preparing.current && preparationPromise.current) await preparationPromise.current;
    if (stopping.current || !capture.current) return;
    capture.current = false;
    stopping.current = true;
    try {
      if (recorder.isRecording) await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error(strings.media.recordingFailed);
      const file = new File(uri);
      if (discard.current || !alive.current) { if (file.exists) file.delete(); return; }
      const attachment: DraftAttachment = { id: ids.mediaId(), name: strings.media.voice, uri, mediaType: 'voice', mime: 'audio/mp4', sizeBytes: file.size };
      const refusal = attachmentRefusal(attachment, attachment.name);
      if (refusal) { onError(refusal); if (file.exists) file.delete(); }
      else onRecorded(attachment);
    } catch { if (alive.current) onError(strings.media.recordingFailed); }
    finally {
      try { await setAudioModeAsync({ allowsRecording: false }); } catch { if (alive.current) onError(strings.media.recordingFailed); }
      stopping.current = false;
      if (alive.current) setBusy(false);
    }
  }
  finishRef.current = finish;
  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener('change', (state) => { if (state !== 'active') void finishRef.current(true); });
    return () => { alive.current = false; void finishRef.current(true); sub.remove(); };
  }, []);
  useEffect(() => registerRecorderStop(() => finishRef.current(true)), []);
  useFocusEffect(React.useCallback(() => () => { void finishRef.current(true); }, []));
  useEffect(() => {
    const subscription = recorder.addListener('recordingStatusUpdate', (event) => {
      if (event.isFinished || event.hasError) void finishRef.current(event.hasError);
      if (event.hasError && alive.current) onError(strings.media.recordingFailed);
    });
    return () => subscription.remove();
  }, [onError, recorder]);

  async function start() {
    if (disabled || isCallAudioOwned() || preparing.current || stopping.current || recorder.isRecording) {
      if (isCallAudioOwned() && alive.current) onError(strings.calls.audioBusy);
      return;
    }
    held.current = true;
    discard.current = false;
    preparing.current = true;
    setBusy(true);
    const preparation = (async () => {
      try {
        if (!(await requestRecordingPermissionsAsync()).granted) { onError(strings.media.permissionDenied); return; }
        if (!held.current || !alive.current || isCallAudioOwned()) return;
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (held.current && alive.current && !isCallAudioOwned()) {
          recorder.record({ forDuration: Math.floor(config.media.smallMaxBytes * 8 / RecordingPresets.HIGH_QUALITY.bitRate) - 1 });
          capture.current = true;
        }
      } catch { if (alive.current) onError(strings.media.recordingFailed); }
      finally {
        preparing.current = false;
        if (!recorder.isRecording) {
          try { await setAudioModeAsync({ allowsRecording: false }); } catch { if (alive.current) onError(strings.media.recordingFailed); }
          if (alive.current) setBusy(false);
        }
      }
    })();
    preparationPromise.current = preparation;
    await preparation;
    preparationPromise.current = null;
  }
  return <View style={styles.wrapper}>
    <Pressable hitSlop={4} onPressIn={() => void start()} onPressOut={() => void finish(false)} disabled={disabled}
      accessibilityRole="button" accessibilityLabel={strings.media.holdToRecord} accessibilityHint="Hold while speaking, then release to attach."
      accessibilityActions={[{ name: 'activate', label: busy ? 'Stop recording' : 'Start recording' }]}
      onAccessibilityAction={() => { if (busy) void finish(false); else void start(); }}
      style={styles.button}>
      <Icon name="action.microphone" size="md" color={busy ? theme.colors.error.text : theme.colors.brand.primary} accessibilityLabel="" />
    </Pressable>
    {busy ? <View style={[styles.recording, { backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.md }]}>
      <Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.error.text }]}>{strings.media.recording} {Math.floor(status.durationMillis / 1000)}s</Text>
      <Pressable hitSlop={4} onPress={() => void finish(true)} accessibilityRole="button" accessibilityLabel={strings.media.cancelRecording} style={styles.button}><Icon name="nav.close" color={theme.colors.error.text} accessibilityLabel="" /></Pressable>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({ wrapper: { width: 40, height: 40 }, button: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, recording: { position: 'absolute', bottom: 48, right: 0, width: 240, padding: 8, flexDirection: 'row', alignItems: 'center' } });
