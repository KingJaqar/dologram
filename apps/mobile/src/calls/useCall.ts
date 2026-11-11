import { createContext, useContext } from 'react';
import type { CallSnapshot, CallState } from '@dologram/shared';
import type { CallVideoTrack } from './media';
import type { CallViewState } from './state';

export type CallContextValue = {
  view: CallViewState;
  currentCall: CallState | null;
  startVoiceCall: (chatId: string) => Promise<void>;
  startVideoCall: (chatId: string) => Promise<void>;
  answerCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  cancelCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  switchCamera: () => Promise<void>;
  selectAudioRoute: (route: string) => Promise<void>;
  openCall: (callId: string) => Promise<void>;
  setCallScreenVisible: (visible: boolean) => void;
  minimizeCall: () => void;
  restoreCall: () => void;
  refreshCall: () => Promise<void>;
};

export const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const value = useContext(CallContext);
  if (!value) throw new Error('useCall must be used inside <CallProvider>');
  return value;
}

export function snapshotCall(snapshot: CallSnapshot | null): CallState | null {
  return snapshot?.call ?? null;
}

export type { CallVideoTrack };
