import type { CallSnapshot, CallState } from '@dologram/shared';
import { phaseForSnapshot } from '../state';

const snapshot = (status: CallState): CallSnapshot => ({
  call: status,
  participants: [],
  capabilities: { canAnswer: false, canCancel: false, canJoin: true, canEnd: true, belongsToThisSession: true },
  availability: { callingEnabled: true },
  serverTime: '2026-11-11T00:00:00.000Z',
  cleanupState: 'not_required',
});

describe('call presentation state', () => {
  it('keeps ringing calls directional', () => {
    const ringing = snapshot({
      callId: 'call', chatId: 'chat', callerId: 'caller', calleeId: 'callee', mediaType: 'voice', status: 'ringing',
      createdAt: '2026-11-11T00:00:00.000Z', ringExpiresAt: '2026-11-11T00:01:00.000Z', acceptedAt: null,
      connectExpiresAt: null, connectedAt: null, endedAt: null, endedBy: null, endReason: null, revision: '1',
    });
    expect(phaseForSnapshot(ringing, false, true)).toBe('outgoing');
    expect(phaseForSnapshot({ ...ringing, capabilities: { ...ringing.capabilities, canAnswer: true } }, false, true)).toBe('incoming');
  });

  it('does not present a native connection as active when the SDK is missing', () => {
    const accepted = snapshot({
      callId: 'call', chatId: 'chat', callerId: 'caller', calleeId: 'callee', mediaType: 'voice', status: 'accepted',
      createdAt: '2026-11-11T00:00:00.000Z', ringExpiresAt: '2026-11-11T00:01:00.000Z', acceptedAt: '2026-11-11T00:00:10.000Z',
      connectExpiresAt: '2026-11-11T00:00:40.000Z', connectedAt: null, endedAt: null, endedBy: null, endReason: null, revision: '2',
    });
    expect(phaseForSnapshot(accepted, false, false)).toBe('unavailable');
  });
});
