import { attachmentDeliveryPolicy, classifyLowSignalMode, hasWaitingWifiPolicy } from '../lowSignal';
import type { NetState } from '../netState';

const wifi: NetState = { isConnected: true, type: 'wifi', cellularGeneration: null };
const cellular4g: NetState = { isConnected: true, type: 'cellular', cellularGeneration: '4g' };
const cellular2g: NetState = { isConnected: true, type: 'cellular', cellularGeneration: '2g' };
const unknownCellular: NetState = { isConnected: true, type: 'cellular', cellularGeneration: null };
const offline: NetState = { isConnected: false, type: 'none', cellularGeneration: null };

describe('Low Signal Mode classification (M3-05, LS-5)', () => {
  test.each([
    [wifi, false, 'normal'],
    [cellular4g, false, 'normal'],
    [unknownCellular, false, 'normal'],
    [cellular2g, false, 'automatic'],
    [cellular4g, true, 'forced'],
    [offline, true, 'none'],
  ] as const)('classifies %s force=%s as %s', (state, force, expected) => {
    expect(classifyLowSignalMode(state, force)).toBe(expected);
  });

  test('automatic mode compresses photos and defers large media only', () => {
    expect(attachmentDeliveryPolicy(cellular2g, false, 'photo', 1000)).toEqual({ compressPhoto: true, waitForWifi: false });
    expect(attachmentDeliveryPolicy(cellular2g, false, 'video', 5_242_880)).toEqual({ compressPhoto: false, waitForWifi: false });
    expect(attachmentDeliveryPolicy(cellular2g, false, 'video', 5_242_881)).toEqual({ compressPhoto: false, waitForWifi: true });
  });

  test('forced mode compresses photos and waits for Wi-Fi for media', () => {
    expect(attachmentDeliveryPolicy(cellular4g, true, 'photo', 1000)).toEqual({ compressPhoto: true, waitForWifi: true });
    expect(attachmentDeliveryPolicy(cellular4g, true, 'file', 1000)).toEqual({ compressPhoto: false, waitForWifi: true });
    expect(attachmentDeliveryPolicy(wifi, true, 'photo', 1000)).toEqual({ compressPhoto: true, waitForWifi: false });
  });

  test('no connection overrides force and never claims a Wi-Fi deferral', () => {
    expect(hasWaitingWifiPolicy(offline, true, [{ media_type: 'video', size_bytes: 50_000_000 }])).toBe(false);
  });
});
