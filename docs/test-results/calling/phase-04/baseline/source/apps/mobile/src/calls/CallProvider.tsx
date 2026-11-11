import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { strings } from '@dologram/shared';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { ids } from '../lib/ids';
import { loadChatPreferences, subscribeChatPreferenceChanges } from '../chats/preferences';
import { loadNotificationPreferences } from '../notifications/preferences';
import { useTheme } from '../theme/ThemeProvider';
import { acquireCallAudio } from './audioOwnership';
import { createVoiceCall, fetchCallSnapshot, fetchCallToken, transitionCall, type CallApiError } from './api';
import { registerCallSessionTeardown } from './lifecycle';
import { connectVoice, isCallingNativeAvailable, listAudioRoutes, selectAudioRoute as selectNativeAudioRoute, setMicrophoneEnabled, type VoiceConnection } from './media';
import { startCallRealtime, type CallRealtimeHandle } from './realtime';
import { isTerminalCallStatus, phaseForSnapshot, type CallViewState } from './state';
import { CallContext, snapshotCall, type CallContextValue } from './useCall';

const EMPTY_VIEW: CallViewState = {
  phase: 'idle',
  snapshot: null,
  callId: null,
  muted: false,
  audioRoutes: [],
  selectedAudioRoute: null,
  minimized: false,
  error: null,
  mediaAvailable: isCallingNativeAvailable(),
  peerName: strings.chatList.unknownMember,
};

function isRetryableError(error: unknown): boolean {
  return (error as CallApiError | undefined)?.retryable === true;
}

function callErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'CALL_NATIVE_UNAVAILABLE') return strings.calls.missingNative;
  if (error instanceof Error && /(CALL_MICROPHONE_DENIED|permission|not allowed|denied)/i.test(error.message)) return strings.calls.micDenied;
  if (isRetryableError(error)) return strings.calls.providerUnavailable;
  return strings.calls.callFailed;
}

function revisionIsOlder(nextRevision: string, currentRevision: string): boolean {
  const next = nextRevision.replace(/^0+/, '') || '0';
  const current = currentRevision.replace(/^0+/, '') || '0';
  return next.length < current.length || (next.length === current.length && next < current);
}

function otherParticipant(snapshot: CallViewState, userId: string): string | null {
  const call = snapshot.snapshot?.call;
  if (!call) return null;
  return call.callerId === userId ? call.calleeId : call.callerId;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const theme = useTheme();
  const { status, session } = useAuth();
  const userId = status === 'signedIn' ? session?.user.id : undefined;
  const [view, setView] = useState<CallViewState>(EMPTY_VIEW);
  const viewRef = useRef(view);
  const realtimeRef = useRef<CallRealtimeHandle | null>(null);
  const clientSessionIdRef = useRef(ids.messageId());
  const generationRef = useRef(0);
  const refreshingRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const mediaRef = useRef<VoiceConnection | null>(null);
  const releaseAudioRef = useRef<(() => void) | null>(null);
  const mediaConnectedRef = useRef(false);
  const mediaStartingRef = useRef(false);
  const screenVisibleRef = useRef(false);
  const blockedDeclinesRef = useRef(new Set<string>());
  const peerNameRequestRef = useRef(new Set<string>());
  const microphoneDeniedRef = useRef(false);

  viewRef.current = view;

  const setViewSafe = useCallback((next: CallViewState | ((current: CallViewState) => CallViewState)) => {
    setView((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      viewRef.current = resolved;
      return resolved;
    });
  }, []);

  const stopMedia = useCallback(async () => {
    const connection = mediaRef.current;
    mediaRef.current = null;
    mediaConnectedRef.current = false;
    mediaStartingRef.current = false;
    releaseAudioRef.current?.();
    releaseAudioRef.current = null;
    await connection?.stop();
  }, []);

  const applySnapshot = useCallback(async (next: CallViewState['snapshot'], generation = generationRef.current) => {
    if (generation !== generationRef.current) return;
    if (!next?.call) {
      if (isTerminalCallStatus(viewRef.current.snapshot?.call?.status)) {
        setViewSafe((current) => ({ ...current, phase: 'ended' }));
      } else {
        setViewSafe((current) => ({ ...EMPTY_VIEW, mediaAvailable: current.mediaAvailable }));
      }
      return;
    }

    const call = next.call;
    const currentCall = viewRef.current.snapshot?.call;
    if (currentCall?.callId === call.callId && revisionIsOlder(call.revision, currentCall.revision)) return;
    setViewSafe((current) => ({
      ...current,
      snapshot: next,
      callId: call.callId,
      phase: phaseForSnapshot(next, mediaConnectedRef.current, current.mediaAvailable),
      error: null,
    }));

    if (call.status === 'ringing' && next.capabilities.canAnswer && !blockedDeclinesRef.current.has(call.callId) && userId) {
      const preferences = await loadChatPreferences(userId, call.chatId).catch(() => null);
      await loadNotificationPreferences(userId).catch(() => undefined);
      if (preferences?.blocked) {
        blockedDeclinesRef.current.add(call.callId);
        try {
          const declined = await transitionCall('decline', call.callId, clientSessionIdRef.current);
          await applySnapshot(declined, generation);
        } catch {
          setViewSafe((current) => ({ ...current, error: strings.calls.blocked }));
        }
        return;
      }
      if (!screenVisibleRef.current || viewRef.current.callId !== call.callId) {
        router.push({ pathname: '/call/[callId]', params: { callId: call.callId } });
      }
    }

    if (isTerminalCallStatus(call.status)) {
      await stopMedia();
      setViewSafe((current) => ({ ...current, snapshot: next, phase: 'ended', minimized: false }));
      return;
    }

    if ((call.status === 'accepted' || call.status === 'in_progress') && next.capabilities.canJoin && !mediaRef.current && !mediaStartingRef.current) {
      if (!viewRef.current.mediaAvailable) {
        setViewSafe((current) => ({ ...current, phase: 'unavailable', error: strings.calls.missingNative }));
        return;
      }
      mediaStartingRef.current = true;
      try {
        const release = await acquireCallAudio();
        releaseAudioRef.current = release;
        const token = await fetchCallToken(call.callId, clientSessionIdRef.current);
        const connection = await connectVoice(token, (mediaState) => {
          mediaConnectedRef.current = mediaState === 'connected';
          if (mediaState === 'disconnected' && mediaRef.current) {
            void stopMedia().then(async () => {
              const ended = await transitionCall('end', call.callId, clientSessionIdRef.current);
              await applySnapshot(ended, generation);
            }).catch(() => {
              setViewSafe((current) => ({ ...current, phase: 'unavailable', error: strings.calls.callFailed }));
            });
            return;
          }
          setViewSafe((current) => ({
            ...current,
            phase: mediaState === 'reconnecting' ? 'reconnecting' : phaseForSnapshot(current.snapshot, mediaConnectedRef.current, current.mediaAvailable),
          }));
        });
        mediaRef.current = connection;
        setViewSafe((current) => ({ ...current, phase: 'active', error: null }));
      } catch (error) {
        releaseAudioRef.current?.();
        releaseAudioRef.current = null;
        setViewSafe((current) => ({ ...current, phase: 'unavailable', error: callErrorMessage(error) }));
      } finally {
        mediaStartingRef.current = false;
      }
    }
  }, [router, setViewSafe, stopMedia, userId]);

  const refreshCall = useCallback(async () => {
    if (!userId || refreshingRef.current) {
      refreshQueuedRef.current = Boolean(userId);
      return;
    }
    refreshingRef.current = true;
    const generation = generationRef.current;
    try {
      const callId = viewRef.current.callId ?? undefined;
      const snapshot = await fetchCallSnapshot(clientSessionIdRef.current, callId);
      await applySnapshot(snapshot, generation);
    } catch (error) {
      if (generation === generationRef.current && viewRef.current.phase !== 'active') {
        setViewSafe((current) => ({ ...current, error: callErrorMessage(error) }));
      }
    } finally {
      refreshingRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void refreshCall();
      }
    }
  }, [applySnapshot, setViewSafe, userId]);

  const performTransition = useCallback(async (action: 'accept' | 'decline' | 'cancel' | 'end') => {
    const callId = viewRef.current.callId;
    if (!callId || !userId) return;
    try {
      const next = await transitionCall(action, callId, clientSessionIdRef.current);
      await applySnapshot(next);
    } catch (error) {
      setViewSafe((current) => ({ ...current, error: callErrorMessage(error) }));
    }
  }, [applySnapshot, setViewSafe, userId]);

  const ensureMicrophonePermission = useCallback(async (): Promise<boolean> => {
    if (microphoneDeniedRef.current) {
      setViewSafe((current) => ({ ...current, error: strings.calls.micDenied }));
      return false;
    }
    const permission = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
    if (!permission.granted) {
      microphoneDeniedRef.current = true;
      setViewSafe((current) => ({ ...current, error: strings.calls.micDenied }));
      return false;
    }
    return true;
  }, [setViewSafe]);

  const startVoiceCall = useCallback(async (chatId: string) => {
    if (!userId) return;
    if (!viewRef.current.mediaAvailable) {
      setViewSafe((current) => ({ ...current, error: strings.calls.missingNative }));
      return;
    }
    if (viewRef.current.snapshot?.call && !isTerminalCallStatus(viewRef.current.snapshot.call.status)) {
      router.push({ pathname: '/call/[callId]', params: { callId: viewRef.current.callId ?? '' } });
      return;
    }
    setViewSafe({ ...EMPTY_VIEW, mediaAvailable: viewRef.current.mediaAvailable });
    if (!(await ensureMicrophonePermission())) return;
    clientSessionIdRef.current = ids.messageId();
    try {
      const next = await createVoiceCall(chatId, clientSessionIdRef.current);
      await applySnapshot(next);
      if (next.call) router.push({ pathname: '/call/[callId]', params: { callId: next.call.callId } });
    } catch (error) {
      setViewSafe((current) => ({ ...current, error: callErrorMessage(error) }));
    }
  }, [applySnapshot, ensureMicrophonePermission, router, setViewSafe, userId]);

  const answerCall = useCallback(async () => {
    if (await ensureMicrophonePermission()) await performTransition('accept');
  }, [ensureMicrophonePermission, performTransition]);

  const toggleMute = useCallback(async () => {
    const room = mediaRef.current?.room;
    if (!room) return;
    const nextMuted = !viewRef.current.muted;
    try {
      await setMicrophoneEnabled(room, !nextMuted);
      setViewSafe((current) => ({ ...current, muted: nextMuted }));
    } catch (error) {
      setViewSafe((current) => ({ ...current, error: callErrorMessage(error) }));
    }
  }, [setViewSafe]);

  const selectAudioRoute = useCallback(async (route: string) => {
    try {
      await selectNativeAudioRoute(route);
      setViewSafe((current) => ({ ...current, selectedAudioRoute: route }));
    } catch {
      setViewSafe((current) => ({ ...current, error: strings.calls.routeUnavailable }));
    }
  }, [setViewSafe]);

  const openCall = useCallback(async (callId: string) => {
    if (!userId || !callId) return;
    setViewSafe((current) => ({ ...current, callId, error: null }));
    try {
      const snapshot = await fetchCallSnapshot(clientSessionIdRef.current, callId);
      await applySnapshot(snapshot);
    } catch (error) {
      setViewSafe((current) => ({ ...current, error: callErrorMessage(error) }));
    }
  }, [applySnapshot, setViewSafe, userId]);

  const setCallScreenVisible = useCallback((visible: boolean) => {
    screenVisibleRef.current = visible;
    if (visible) setViewSafe((current) => ({ ...current, minimized: false }));
  }, [setViewSafe]);

  const minimizeCall = useCallback(() => {
    screenVisibleRef.current = false;
    setViewSafe((current) => ({ ...current, minimized: true }));
  }, [setViewSafe]);

  const restoreCall = useCallback(() => {
    const callId = viewRef.current.callId;
    if (!callId) return;
    screenVisibleRef.current = true;
    setViewSafe((current) => ({ ...current, minimized: false }));
    router.push({ pathname: '/call/[callId]', params: { callId } });
  }, [router, setViewSafe]);

  const teardownForSessionChange = useCallback(async (oldUserId: string | undefined) => {
    const current = viewRef.current;
    const call = current.snapshot?.call;
    await stopMedia();
    setViewSafe((next) => ({ ...EMPTY_VIEW, mediaAvailable: next.mediaAvailable }));
    if (!oldUserId || !call || isTerminalCallStatus(call.status)) return;
    if (current.snapshot?.capabilities.canCancel || current.snapshot?.capabilities.canEnd) {
      const action = current.snapshot.capabilities.canCancel ? 'cancel' : 'end';
      await Promise.race([
        transitionCall(action, call.callId, clientSessionIdRef.current).catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 1500)),
      ]);
    }
  }, [setViewSafe, stopMedia]);

  useEffect(() => registerCallSessionTeardown(teardownForSessionChange), [teardownForSessionChange]);

  useEffect(() => {
    generationRef.current += 1;
    clientSessionIdRef.current = ids.messageId();
    blockedDeclinesRef.current.clear();
    microphoneDeniedRef.current = false;
    void stopMedia();
    setViewSafe({ ...EMPTY_VIEW, mediaAvailable: isCallingNativeAvailable() });
  }, [setViewSafe, stopMedia, userId]);

  useEffect(() => {
    if (!userId) return;
    const realtime = startCallRealtime(() => void refreshCall());
    realtimeRef.current = realtime;
    void refreshCall();
    return () => {
      if (realtimeRef.current === realtime) realtimeRef.current = null;
      void realtime.stop();
    };
  }, [refreshCall, userId]);

  useEffect(() => {
    const chatId = view.snapshot?.call?.chatId;
    if (!userId || !chatId || view.snapshot?.call?.status !== 'ringing') return;
    return subscribeChatPreferenceChanges(userId, chatId, () => void refreshCall());
  }, [refreshCall, userId, view.snapshot?.call?.chatId, view.snapshot?.call?.status]);

  const activeCall = view.snapshot?.call;
  const activeCallId = activeCall?.callId;
  const activeCallStatus = activeCall?.status;
  useEffect(() => {
    if (!userId || !activeCallId || !activeCallStatus || isTerminalCallStatus(activeCallStatus)) return;
    let remaining = 30;
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining < 0) {
        clearInterval(timer);
        return;
      }
      void refreshCall();
    }, 2000);
    return () => clearInterval(timer);
  }, [activeCallId, activeCallStatus, refreshCall, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refreshCall();
    });
    return () => subscription.remove();
  }, [refreshCall]);

  useEffect(() => {
    const callId = view.snapshot?.call?.callId;
    const peerId = userId && callId ? otherParticipant(view, userId) : null;
    if (!peerId || peerNameRequestRef.current.has(peerId)) return;
    peerNameRequestRef.current.add(peerId);
    void supabase.from('profiles').select('display_name, username').eq('user_id', peerId).maybeSingle().then(({ data }) => {
      if (!data) return;
      setViewSafe((current) => ({ ...current, peerName: data.display_name || data.username || strings.chatList.unknownMember }));
    }, () => undefined);
  }, [setViewSafe, userId, view]);

  useEffect(() => {
    if (!activeCall || view.phase === 'idle' || view.phase === 'ended') return;
    void listAudioRoutes().then((routes) => {
      setViewSafe((current) => ({ ...current, audioRoutes: routes, selectedAudioRoute: current.selectedAudioRoute ?? routes[0] ?? null }));
    }).catch(() => undefined);
  }, [activeCall, setViewSafe, view.phase]);

  const value = useMemo<CallContextValue>(() => ({
    view,
    currentCall: snapshotCall(view.snapshot),
    startVoiceCall,
    answerCall,
    declineCall: () => performTransition('decline'),
    cancelCall: () => performTransition('cancel'),
    endCall: () => performTransition('end'),
    toggleMute,
    selectAudioRoute,
    openCall,
    setCallScreenVisible,
    minimizeCall,
    restoreCall,
    refreshCall,
  }), [answerCall, minimizeCall, openCall, performTransition, refreshCall, restoreCall, selectAudioRoute, setCallScreenVisible, startVoiceCall, toggleMute, view]);

  return (
    <CallContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {view.minimized && view.snapshot?.call && !isTerminalCallStatus(view.snapshot.call.status) ? (
          <Pressable
            style={[styles.banner, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.separator }]}
            onPress={restoreCall}
            accessibilityRole="button"
            accessibilityLabel={strings.calls.returnToCall}
          >
            <View style={styles.bannerCopy}>
              <Text style={[styles.bannerTitle, { color: theme.colors.text.primary }]}>{strings.calls.voiceLabel}</Text>
              <Text style={[styles.bannerSubtitle, { color: theme.colors.text.secondary }]} numberOfLines={1}>{view.peerName}</Text>
            </View>
            <Text style={[styles.bannerAction, { color: theme.colors.brand.primary }]}>{strings.calls.returnToCall}</Text>
          </Pressable>
        ) : null}
      </View>
    </CallContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
  },
  bannerCopy: { flex: 1, marginRight: 12 },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerSubtitle: { marginTop: 2, fontSize: 13 },
  bannerAction: { fontSize: 14, fontWeight: '700' },
});
