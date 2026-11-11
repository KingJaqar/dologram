import { NativeModules, Platform } from 'react-native';
import type { Participant, Room, Track, TrackPublication } from 'livekit-client';
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

export type CallVideoTrack = {
  participant: Participant;
  publication: TrackPublication;
  source: Track.Source;
};

export type CallMediaConnection = {
  room: Room;
  stop: () => Promise<void>;
};

export type VideoTrackComponent = typeof import('@livekit/react-native').VideoTrack;

const cameraSource = 'camera' as Track.Source;

function collectVideoTracks(room: Room): CallVideoTrack[] {
  const participants = [room.localParticipant, ...room.remoteParticipants.values()];
  return participants.flatMap((participant) => {
    const publication = participant.getTrackPublication(cameraSource);
    return publication && publication.track && !publication.isMuted
      ? [{ participant, publication, source: cameraSource }]
      : [];
  });
}

export function getVideoTracks(room: Room): CallVideoTrack[] {
  return collectVideoTracks(room);
}

export async function loadVideoTrackComponent(): Promise<VideoTrackComponent | null> {
  const runtime = await loadRuntime();
  return runtime?.reactNative.VideoTrack ?? null;
}

export async function connectCall(
  token: CallToken,
  mediaType: 'voice' | 'video',
  initialCameraEnabled: boolean,
  onState: (state: MediaConnectionState) => void,
  onVideoTracks: (tracks: CallVideoTrack[]) => void,
  onCameraError: (error: unknown) => void,
): Promise<CallMediaConnection> {
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

  const room = new runtime.client.Room({
    adaptiveStream: { pixelDensity: 'screen' },
    dynacast: true,
    publishDefaults: {
      simulcast: true,
      videoEncoding: { maxBitrate: 600_000, maxFramerate: 24 },
      stopMicTrackOnMute: true,
    },
    stopLocalTrackOnUnpublish: true,
  });
  const onReconnecting = () => onState('reconnecting');
  const onReconnected = () => onState('connected');
  const onDisconnected = () => onState('disconnected');
  const refreshVideoTracks = () => onVideoTracks(collectVideoTracks(room));
  room.on(runtime.client.RoomEvent.Reconnecting, onReconnecting);
  room.on(runtime.client.RoomEvent.Reconnected, onReconnected);
  room.on(runtime.client.RoomEvent.Disconnected, onDisconnected);
  room.on(runtime.client.RoomEvent.TrackPublished, refreshVideoTracks);
  room.on(runtime.client.RoomEvent.TrackSubscribed, refreshVideoTracks);
  room.on(runtime.client.RoomEvent.TrackUnpublished, refreshVideoTracks);
  room.on(runtime.client.RoomEvent.TrackUnsubscribed, refreshVideoTracks);
  room.on(runtime.client.RoomEvent.TrackMuted, refreshVideoTracks);
  room.on(runtime.client.RoomEvent.TrackUnmuted, refreshVideoTracks);
  room.on(runtime.client.RoomEvent.LocalTrackPublished, refreshVideoTracks);
  room.on(runtime.client.RoomEvent.LocalTrackUnpublished, refreshVideoTracks);

  try {
    await room.connect(token.serverUrl, token.participantToken, { autoSubscribe: true });
    await room.localParticipant.setMicrophoneEnabled(true);
    if (mediaType === 'video' && initialCameraEnabled) {
      try {
        await room.localParticipant.setCameraEnabled(true, {
          resolution: { width: 640, height: 360, frameRate: 24 },
          frameRate: 24,
        });
      } catch (error) {
        onCameraError(error);
      }
    }
    refreshVideoTracks();
    onState('connected');
  } catch (error) {
    room.off(runtime.client.RoomEvent.Reconnecting, onReconnecting);
    room.off(runtime.client.RoomEvent.Reconnected, onReconnected);
    room.off(runtime.client.RoomEvent.Disconnected, onDisconnected);
    room.off(runtime.client.RoomEvent.TrackPublished, refreshVideoTracks);
    room.off(runtime.client.RoomEvent.TrackSubscribed, refreshVideoTracks);
    room.off(runtime.client.RoomEvent.TrackUnpublished, refreshVideoTracks);
    room.off(runtime.client.RoomEvent.TrackUnsubscribed, refreshVideoTracks);
    room.off(runtime.client.RoomEvent.TrackMuted, refreshVideoTracks);
    room.off(runtime.client.RoomEvent.TrackUnmuted, refreshVideoTracks);
    room.off(runtime.client.RoomEvent.LocalTrackPublished, refreshVideoTracks);
    room.off(runtime.client.RoomEvent.LocalTrackUnpublished, refreshVideoTracks);
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
      room.off(runtime.client.RoomEvent.TrackPublished, refreshVideoTracks);
      room.off(runtime.client.RoomEvent.TrackSubscribed, refreshVideoTracks);
      room.off(runtime.client.RoomEvent.TrackUnpublished, refreshVideoTracks);
      room.off(runtime.client.RoomEvent.TrackUnsubscribed, refreshVideoTracks);
      room.off(runtime.client.RoomEvent.TrackMuted, refreshVideoTracks);
      room.off(runtime.client.RoomEvent.TrackUnmuted, refreshVideoTracks);
      room.off(runtime.client.RoomEvent.LocalTrackPublished, refreshVideoTracks);
      room.off(runtime.client.RoomEvent.LocalTrackUnpublished, refreshVideoTracks);
      await room.disconnect(true).catch(() => undefined);
      await runtime.reactNative.AudioSession.stopAudioSession().catch(() => undefined);
    },
  };
}

export async function setMicrophoneEnabled(room: Room, enabled: boolean): Promise<void> {
  await room.localParticipant.setMicrophoneEnabled(enabled);
}

export async function setCameraEnabled(room: Room, enabled: boolean): Promise<void> {
  if (enabled) {
    await room.localParticipant.setCameraEnabled(true, {
      resolution: { width: 640, height: 360, frameRate: 24 },
      frameRate: 24,
    });
    return;
  }

  const publication = room.localParticipant.getTrackPublication(cameraSource);
  if (publication?.track) {
    await room.localParticipant.unpublishTrack(publication.track, true);
  } else {
    await room.localParticipant.setCameraEnabled(false);
  }
}

export async function listCameraDevices(): Promise<{ id: string; label: string }[]> {
  const runtime = await loadRuntime();
  if (!runtime) return [];
  const devices = await runtime.client.Room.getLocalDevices('videoinput', false);
  return devices.map((device) => ({ id: device.deviceId, label: device.label || 'Camera' }));
}

export async function switchCamera(room: Room, deviceId: string): Promise<void> {
  if (!deviceId) throw new Error('CALL_CAMERA_UNAVAILABLE');
  const switched = await room.switchActiveDevice('videoinput', deviceId, true);
  if (!switched) throw new Error('CALL_CAMERA_UNAVAILABLE');
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
