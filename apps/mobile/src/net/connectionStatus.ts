import type { NetState } from './netState';

export type ConnectionStatus = 'stable' | 'unstable' | 'free' | 'offline';

export const CONNECTION_INDICATORS: Record<ConnectionStatus, { label: string }> = {
  stable: { label: 'Online, stable connection' },
  unstable: { label: 'Connection unstable or checking internet access' },
  free: { label: 'Online in free mode' },
  offline: { label: 'Offline, no network connection' },
};

/**
 * Quality is an estimate from OS reachability and radio information, not a speed test.
 * Only a carrier/service integration that confirms app access without paid data may
 * set freeModeConfirmed. A cellular signal, metered plan, or low-data preference
 * cannot establish free access to DoloGram's messaging and photo services.
 */
export function classifyConnectionStatus(
  state: NetState,
  freeModeConfirmed = false,
): ConnectionStatus {
  if (!state.isConnected || state.type === 'none') return 'offline';
  if (state.type === 'cellular' && freeModeConfirmed) return 'free';
  if (state.isInternetReachable !== true) return 'unstable';
  if (state.type === 'cellular'
    && (state.cellularGeneration === null || state.cellularGeneration === '2g' || state.cellularGeneration === '3g')) {
    return 'unstable';
  }
  if (state.type === 'wifi' && state.wifiStrength != null && state.wifiStrength < 40) {
    return 'unstable';
  }
  return 'stable';
}
