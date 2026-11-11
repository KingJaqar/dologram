import { NativeModules, Platform } from 'react-native';
import type { Room } from 'livekit-client';
import type { CallToken } from './api';

type LiveKitReactNative = typeof import('@livekit/react-native');
type LiveKitClient = typeof import('livekit-client');
type LiveKitRuntime = { reactNative: LiveKitReactNative; client: LiveKitClient };

let runtimePromise: Promise<LiveKitRuntime | null> | null = null;
let globalsRegistered = false;

function hasNativeRuntime(): boolean {
  return (Platform.OS === 'android' || Platform.OS === 'ios')
    && Boolean(NativeModules.LivekitReactNativeModule)
    && Boolean(NativeModules.WebRTCModule);
}

export function isCallingNativeAvailable(): boolean {
  return hasNativeRuntime();
}

async function loadRuntime(): Promise<LiveKitRuntime | null> {
  if (!hasNativeRuntime()) return null;
  if (!runtimePromise) {
    runtimePromise = Promise.all([import('@livekit/react-native'), import('livekit-client')])
      .then(([reactNative, client]) => {
        if (!globalsRegistered) {
          reactNative.registerGlobals();
          globalsRegistered = true;
        }
        return { reactNative, client };
      })
      .catch(() => null);
  }
  return runtimePromise;
}

export type MediaConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export type VoiceConnection = {
  room: Room;
  stop: () => Promise<void>;
};

export async function connectVoice(
  token: CallToken,
  onState: (state: MediaConnectionState) => void,
): Promise<VoiceConnection> {
  const runtime = await loadRuntime();
  if (!runtime) throw new Error('CALL_NATIVE_UNAVAILABLE');

  await runtime.reactNative.AudioSession.configureAudio({
    android: {
      preferredOutputList: ['bluetooth', 'headset', 'speaker', 'earpiece'],
      audioTypeOptions: runtime.reactNative.AndroidAudioTypePresets.communication,
    },
    ios: { defaultOutput: 'speaker' },
  });
  await runtime.reactNative.AudioSession.startAudioSession();

  const room = new runtime.client.Room();
  const onReconnecting = () => onState('reconnecting');
  const onReconnected = () => onState('connected');
  const onDisconnected = () => onState('disconnected');
  room.on(runtime.client.RoomEvent.Reconnecting, onReconnecting);
  room.on(runtime.client.RoomEvent.Reconnected, onReconnected);
  room.on(runtime.client.RoomEvent.Disconnected, onDisconnected);

  try {
    await room.connect(token.serverUrl, token.participantToken, { autoSubscribe: true });
    await room.localParticipant.setMicrophoneEnabled(true);
    onState('connected');
  } catch (error) {
    room.off(runtime.client.RoomEvent.Reconnecting, onReconnecting);
    room.off(runtime.client.RoomEvent.Reconnected, onReconnected);
    room.off(runtime.client.RoomEvent.Disconnected, onDisconnected);
    await room.disconnect(true).catch(() => undefined);
    await runtime.reactNative.AudioSession.stopAudioSession().catch(() => undefined);
    throw error;
  }

  return {
    room,
    async stop() {
      room.off(runtime.client.RoomEvent.Reconnecting, onReconnecting);
      room.off(runtime.client.RoomEvent.Reconnected, onReconnected);
      room.off(runtime.client.RoomEvent.Disconnected, onDisconnected);
      await room.disconnect(true).catch(() => undefined);
      await runtime.reactNative.AudioSession.stopAudioSession().catch(() => undefined);
    },
  };
}

export async function setMicrophoneEnabled(room: Room, enabled: boolean): Promise<void> {
  await room.localParticipant.setMicrophoneEnabled(enabled);
}

export async function listAudioRoutes(): Promise<string[]> {
  const runtime = await loadRuntime();
  return runtime ? runtime.reactNative.AudioSession.getAudioOutputs() : [];
}

export async function selectAudioRoute(route: string): Promise<void> {
  const runtime = await loadRuntime();
  if (!runtime) throw new Error('CALL_NATIVE_UNAVAILABLE');
  await runtime.reactNative.AudioSession.selectAudioOutput(route);
}
