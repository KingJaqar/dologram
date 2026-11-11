import { config, type MediaType } from '@dologram/shared';
import type { NetState } from './netState';

export type LowSignalMode = 'normal' | 'automatic' | 'forced' | 'none';

export type AttachmentDeliveryPolicy = {
  compressPhoto: boolean;
  waitForWifi: boolean;
};

/** Pure LS-5 classification. No connection always wins over the user preference. */
export function classifyLowSignalMode(state: NetState, forceLowSignalMode: boolean): LowSignalMode {
  if (!state.isConnected || state.type === 'none') return 'none';
  if (forceLowSignalMode) return 'forced';
  if (state.type === 'cellular' && (state.cellularGeneration === '2g' || state.cellularGeneration === '3g')) {
    return 'automatic';
  }
  return 'normal';
}

export function isLowSignalActive(state: NetState, forceLowSignalMode: boolean): boolean {
  const mode = classifyLowSignalMode(state, forceLowSignalMode);
  return mode === 'automatic' || mode === 'forced';
}

export function attachmentDeliveryPolicy(
  state: NetState,
  forceLowSignalMode: boolean,
  mediaType: MediaType,
  sizeBytes: number,
): AttachmentDeliveryPolicy {
  const mode = classifyLowSignalMode(state, forceLowSignalMode);
  if (mediaType === 'photo') {
    return {
      compressPhoto: mode === 'automatic' || mode === 'forced',
      waitForWifi: mode === 'forced' && state.type !== 'wifi',
    };
  }
  return {
    compressPhoto: false,
    waitForWifi:
      mode === 'forced' && state.type !== 'wifi' ||
      mode === 'automatic' && sizeBytes > config.lowSignal.largeMediaBytes,
  };
}

export function hasWaitingWifiPolicy(
  state: NetState,
  forceLowSignalMode: boolean,
  attachments: readonly { media_type: MediaType; size_bytes: number }[],
): boolean {
  return attachments.some((attachment) => attachmentDeliveryPolicy(
    state,
    forceLowSignalMode,
    attachment.media_type,
    attachment.size_bytes,
  ).waitForWifi);
}
