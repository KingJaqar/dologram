import type { CallSnapshot, CallStatus } from '@dologram/shared';
import type { CallVideoTrack } from './media';

export type CallPhase = 'idle' | 'incoming' | 'outgoing' | 'connecting' | 'active' | 'reconnecting' | 'ended' | 'unavailable';

export type CallViewState = {
  phase: CallPhase;
  snapshot: CallSnapshot | null;
  callId: string | null;
  muted: boolean;
  audioRoutes: string[];
  selectedAudioRoute: string | null;
  minimized: boolean;
  error: string | null;
  mediaAvailable: boolean;
  cameraEnabled: boolean;
  cameraAvailable: boolean;
  cameraDevices: { id: string; label: string }[];
  selectedCameraId: string | null;
  videoTracks: CallVideoTrack[];
  peerName: string;
};

export function isTerminalCallStatus(status: CallStatus | undefined): boolean {
  return status === 'declined' || status === 'cancelled' || status === 'missed' || status === 'ended' || status === 'failed';
}

export function phaseForSnapshot(snapshot: CallSnapshot | null, mediaConnected: boolean, mediaAvailable: boolean): CallPhase {
  if (!snapshot?.call) return 'idle';
  if (isTerminalCallStatus(snapshot.call.status)) return 'ended';
  if (!mediaAvailable && (snapshot.call.status === 'accepted' || snapshot.call.status === 'in_progress')) return 'unavailable';
  if (mediaConnected || snapshot.call.status === 'in_progress') return 'active';
  if (snapshot.call.status === 'accepted') return 'connecting';
  return snapshot.capabilities.canAnswer ? 'incoming' : 'outgoing';
}

export function shouldStartCamera(snapshot: CallSnapshot, userId: string | undefined): boolean {
  return snapshot.call?.mediaType === 'video'
    && snapshot.call.status === 'accepted'
    && snapshot.call.callerId === userId;
}
