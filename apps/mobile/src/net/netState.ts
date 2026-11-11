/**
 * Connectivity state for the app (D-13), in the shape the screens need.
 * `isConnected` is false when NetInfo reports type `none` or `isConnected === false`;
 * a still-unknown state counts as connected so the UI never blocks before NetInfo answers.
 * Phase 13 adds the injectable provider on top of the same shape.
 */
import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type NetType = 'wifi' | 'cellular' | 'other' | 'none';
export type CellularGeneration = '2g' | '3g' | '4g' | '5g' | null;

export interface NetState {
  isConnected: boolean;
  type: NetType;
  cellularGeneration: CellularGeneration;
}

export type NetStateProvider = (listener: (state: NetInfoState) => void) => () => void;

function toNetType(type: NetInfoState['type']): NetType {
  switch (type) {
    case 'wifi':
      return 'wifi';
    case 'cellular':
      return 'cellular';
    case 'none':
      return 'none';
    default:
      return 'other';
  }
}

export function toNetState(state: NetInfoState): NetState {
  return {
    isConnected: state.type !== 'none' && state.isConnected !== false,
    type: toNetType(state.type),
    cellularGeneration: state.type === 'cellular' ? state.details.cellularGeneration : null,
  };
}

/** Subscribes to connectivity changes. NetInfo calls the listener with the current state soon after subscribing. */
const defaultProvider: NetStateProvider = (listener) => NetInfo.addEventListener(listener);

export function subscribeNetState(cb: (state: NetState) => void, provider: NetStateProvider = defaultProvider): () => void {
  return provider((state) => cb(toNetState(state)));
}

const INITIAL_NET_STATE: NetState = {
  isConnected: true,
  type: 'other',
  cellularGeneration: null,
};

export function useNetState(): NetState {
  const [state, setState] = useState<NetState>(INITIAL_NET_STATE);

  useEffect(() => subscribeNetState(setState), []);

  return state;
}
