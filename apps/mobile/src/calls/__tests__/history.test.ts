import { callDirection, callOutcome, formatCallDuration } from '../historyFormat';

describe('call history formatting', () => {
  it('formats non-negative connected duration', () => {
    expect(formatCallDuration({ connectedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:01:05.000Z' })).toBe('1:05');
    expect(formatCallDuration({ connectedAt: '2026-01-01T00:01:00.000Z', endedAt: '2026-01-01T00:00:00.000Z' })).toBe('0:00');
    expect(formatCallDuration({ connectedAt: null, endedAt: '2026-01-01T00:01:05.000Z' })).toBe('0:00');
    expect(formatCallDuration({ connectedAt: null, endedAt: null })).toBeNull();
  });

  it('classifies direction and terminal outcome', () => {
    expect(callDirection({ callerId: 'caller', calleeId: 'callee' }, 'caller')).toBe('outgoing');
    expect(callDirection({ callerId: 'caller', calleeId: 'callee' }, 'callee')).toBe('incoming');
    expect(callOutcome({ status: 'missed', endReason: 'no_answer' })).toBe('Missed');
    expect(callOutcome({ status: 'ended', endReason: 'busy' })).toBe('Busy');
  });
});
