import { isChatMutedUntil, shouldPresentIncomingCall } from '../alertsPolicy';

describe('incoming call alert policy', () => {
  it('respects device, notification and server mute settings', () => {
    expect(isChatMutedUntil('infinity')).toBe(true);
    expect(isChatMutedUntil('2026-01-01T00:00:00.000Z', Date.parse('2025-01-01T00:00:00.000Z'))).toBe(true);
    expect(isChatMutedUntil('2024-01-01T00:00:00.000Z', Date.parse('2025-01-01T00:00:00.000Z'))).toBe(false);
    expect(shouldPresentIncomingCall({ chatPreferences: null, notificationPreferences: null, serverMuted: false })).toBe(true);
    expect(shouldPresentIncomingCall({ chatPreferences: { blocked: false, notifications: false }, notificationPreferences: { enabled: true }, serverMuted: false })).toBe(false);
    expect(shouldPresentIncomingCall({ chatPreferences: { blocked: false, notifications: true }, notificationPreferences: { enabled: true }, serverMuted: true })).toBe(false);
  });
});
