import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { strings } from '@dologram/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/components/Icon';
import { useCall } from '../../src/calls/useCall';
import { loadVideoTrackComponent, type VideoTrackComponent } from '../../src/calls/media';
import type { CallVideoTrack } from '../../src/calls/useCall';
import { useTheme } from '../../src/theme/ThemeProvider';

function paramValue(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : value?.[0] ?? '';
}

function statusLabel(phase: ReturnType<typeof useCall>['view']['phase'], video: boolean): string {
  if (phase === 'incoming') return video ? strings.calls.incomingVideo : strings.calls.incomingVoice;
  if (phase === 'outgoing') return strings.calls.outgoingVideo;
  if (phase === 'connecting') return strings.calls.connecting;
  if (phase === 'reconnecting') return strings.calls.reconnecting;
  if (phase === 'unavailable') return strings.calls.missingNative;
  if (phase === 'ended') return strings.calls.ended;
  return video ? strings.calls.videoLabel : strings.calls.voiceLabel;
}

function VideoSurface({ tracks, mediaAvailable }: { tracks: CallVideoTrack[]; mediaAvailable: boolean }) {
  const [VideoTrack, setVideoTrack] = useState<VideoTrackComponent | null>(null);
  const theme = useTheme();

  useEffect(() => {
    let mounted = true;
    void loadVideoTrackComponent().then((component) => {
      if (mounted) setVideoTrack(component);
    });
    return () => { mounted = false; };
  }, []);

  const remote = tracks.find((track) => !track.participant.isLocal);
  const local = tracks.find((track) => track.participant.isLocal);

  if (!VideoTrack) {
    return (
      <View style={[styles.videoUnavailable, { backgroundColor: theme.colors.bg.surface }]}>
        <Text style={[styles.videoUnavailableText, { color: theme.colors.text.secondary }]}>{mediaAvailable ? strings.calls.videoUnavailable : strings.calls.missingNative}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.videoStage, { backgroundColor: theme.colors.bg.surface }]} accessibilityLabel={strings.calls.videoLabel}>
      <View style={styles.remoteVideo}>
        {remote ? <VideoTrack trackRef={remote} style={styles.videoFill} objectFit="cover" /> : <Text style={[styles.videoPlaceholder, { color: theme.colors.text.secondary }]}>{strings.calls.videoUnavailable}</Text>}
      </View>
      {local ? (
        <View style={[styles.localVideo, { backgroundColor: theme.colors.bg.pressed }]}>
          <VideoTrack trackRef={local} style={styles.videoFill} objectFit="cover" mirror />
        </View>
      ) : null}
    </View>
  );
}

export default function CallScreen() {
  const { callId: rawCallId } = useLocalSearchParams<{ callId?: string | string[] }>();
  const callId = paramValue(rawCallId);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { view, openCall, setCallScreenVisible, minimizeCall, answerCall, declineCall, cancelCall, toggleMute, toggleCamera, switchCamera, endCall, selectAudioRoute } = useCall();
  const isTerminal = view.phase === 'ended';
  const isIncoming = view.phase === 'incoming';
  const isActive = view.phase === 'active' || view.phase === 'reconnecting' || view.phase === 'connecting';
  const isMediaActive = view.phase === 'active' || view.phase === 'reconnecting';
  const isVideo = view.snapshot?.call?.mediaType === 'video';

  useEffect(() => {
    setCallScreenVisible(true);
    void openCall(callId);
    return () => setCallScreenVisible(false);
  }, [callId, openCall, setCallScreenVisible]);

  useFocusEffect(useCallback(() => {
    setCallScreenVisible(true);
    return () => {
      setCallScreenVisible(false);
      if (!isTerminal && isActive) minimizeCall();
    };
  }, [isActive, isTerminal, minimizeCall, setCallScreenVisible]));

  const close = useCallback(() => {
    if (isActive) {
      minimizeCall();
    }
    router.back();
  }, [isActive, minimizeCall, router]);

  const routeButtons = useMemo(() => view.audioRoutes.filter((route) => route !== view.selectedAudioRoute), [view.audioRoutes, view.selectedAudioRoute]);

  if (!callId) {
    return <View style={[styles.center, { backgroundColor: theme.colors.bg.app }]}><Text style={{ color: theme.colors.text.primary }}>{strings.calls.callFailed}</Text></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.app, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel={isActive ? strings.calls.returnToCall : strings.common.back}>
          <Icon name="nav.close" color={theme.colors.text.primary} accessibilityLabel="" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>{isVideo ? strings.calls.videoLabel : strings.calls.voiceLabel}</Text>
        <View style={styles.close} />
      </View>

      <View style={styles.content}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.brand.primary }]}>
          <Icon name="action.phone" size="lg" color={theme.colors.text.inverse} accessibilityLabel="" />
        </View>
        <Text style={[styles.peerName, { color: theme.colors.text.primary }]}>{view.peerName}</Text>
        <Text style={[styles.status, { color: theme.colors.text.secondary }]}>{statusLabel(view.phase, isVideo)}</Text>

        {view.error ? <Text style={[styles.error, { color: theme.colors.error.text }]} accessibilityRole="alert">{view.error}</Text> : null}
        {!view.snapshot && !view.error ? <ActivityIndicator color={theme.colors.brand.primary} style={styles.loading} /> : null}
        {isVideo && isMediaActive ? <VideoSurface tracks={view.videoTracks} mediaAvailable={view.mediaAvailable} /> : null}

        {isIncoming ? (
          <View style={styles.actions}>
            <Button label={strings.calls.answer} onPress={() => void answerCall()} disabled={!view.mediaAvailable} />
            <Button label={strings.calls.decline} variant="danger" onPress={() => void declineCall()} />
          </View>
        ) : null}

        {view.phase === 'outgoing' ? <Button label={strings.calls.cancel} variant="danger" onPress={() => void cancelCall()} /> : null}

        {isMediaActive ? (
          <View style={styles.controls}>
            <Button
              label={view.muted ? strings.calls.unmute : strings.calls.mute}
              variant="secondary"
              onPress={() => void toggleMute()}
              accessibilityLabel={view.muted ? strings.calls.unmute : strings.calls.mute}
            />
            {isVideo ? (
              <>
                <Button
                  label={view.cameraEnabled ? strings.calls.cameraOn : strings.calls.cameraOff}
                  variant="secondary"
                  disabled={!view.cameraAvailable}
                  onPress={() => void toggleCamera()}
                  accessibilityLabel={view.cameraEnabled ? strings.calls.cameraOn : strings.calls.cameraOff}
                />
                <Button
                  label={strings.calls.switchCamera}
                  variant="text"
                  disabled={!view.cameraEnabled || view.cameraDevices.length < 2}
                  onPress={() => void switchCamera()}
                  accessibilityLabel={strings.calls.switchCamera}
                />
              </>
            ) : null}
            <Button label={strings.calls.end} variant="danger" onPress={() => void endCall()} />
            {view.audioRoutes.length === 0 ? <Text style={[styles.routeUnavailable, { color: theme.colors.text.muted }]}>{strings.calls.routeUnavailable}</Text> : null}
            {routeButtons.map((route) => (
              <Button key={route} label={strings.calls.route(route)} variant="text" onPress={() => void selectAudioRoute(route)} />
            ))}
          </View>
        ) : null}

        {isTerminal ? <Button label={strings.common.done} variant="secondary" onPress={() => router.back()} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 14 },
  avatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  peerName: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  status: { fontSize: 16, textAlign: 'center' },
  error: { maxWidth: 340, textAlign: 'center', fontSize: 14 },
  loading: { marginVertical: 10 },
  videoStage: { width: '100%', aspectRatio: 3 / 4, maxHeight: 360, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  remoteVideo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  localVideo: { position: 'absolute', right: 12, top: 12, width: 104, aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden' },
  videoFill: { width: '100%', height: '100%' },
  videoPlaceholder: { fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
  videoUnavailable: { width: '100%', minHeight: 96, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  videoUnavailableText: { fontSize: 14, textAlign: 'center' },
  actions: { width: '100%', gap: 12, marginTop: 20 },
  controls: { width: '100%', gap: 12, marginTop: 20 },
  routeUnavailable: { textAlign: 'center', fontSize: 13 },
});
