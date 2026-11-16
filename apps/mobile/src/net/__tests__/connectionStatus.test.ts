import { classifyConnectionStatus } from '../connectionStatus';
import type { NetState } from '../netState';

const wifi: NetState = {
  isConnected: true, type: 'wifi', cellularGeneration: null,
  isInternetReachable: true, wifiStrength: 80,
};
const cellular: NetState = { ...wifi, type: 'cellular', cellularGeneration: '4g', wifiStrength: null };

test('only reachable connections with no known poor radio conditions are green', () => {
  expect(classifyConnectionStatus(wifi)).toBe('stable');
  expect(classifyConnectionStatus(cellular)).toBe('stable');
  expect(classifyConnectionStatus({ ...cellular, cellularGeneration: '5g' })).toBe('stable');
  for (const isInternetReachable of [false, null, undefined]) {
    expect(classifyConnectionStatus({ ...wifi, isInternetReachable })).toBe('unstable');
  }
  expect(classifyConnectionStatus({ ...wifi, wifiStrength: 20 })).toBe('unstable');
  for (const cellularGeneration of ['2g', '3g', null] as const) {
    expect(classifyConnectionStatus({ ...cellular, cellularGeneration })).toBe('unstable');
  }
});

test('a cellular radio without internet is not proof of free messaging access', () => {
  expect(classifyConnectionStatus({ ...cellular, isInternetReachable: false })).toBe('unstable');
  expect(classifyConnectionStatus({ ...cellular, isInternetReachable: false }, true)).toBe('free');
  expect(classifyConnectionStatus(wifi, true)).toBe('stable');
});

test('no network takes precedence over any free-mode confirmation', () => {
  expect(classifyConnectionStatus({ ...cellular, isConnected: false }, true)).toBe('offline');
  expect(classifyConnectionStatus({ ...wifi, type: 'none' })).toBe('offline');
});
