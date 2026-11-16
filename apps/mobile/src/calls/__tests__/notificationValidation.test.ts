import { fetchCallSnapshot } from '../api';
import { validateCallNotification } from '../notificationValidation';

jest.mock('../api', () => ({ fetchCallSnapshot: jest.fn() }));

const CALL = {
  callId: '11111111-1111-4111-8111-111111111111',
  chatId: '22222222-2222-4222-8222-222222222222',
  callerId: '33333333-3333-4333-8333-333333333333',
  calleeId: '44444444-4444-4444-8444-444444444444',
  mediaType: 'voice' as const,
  status: 'ringing' as const,
  createdAt: '2026-11-12T00:00:00.000Z',
  ringExpiresAt: '2026-11-12T00:00:30.000Z',
  acceptedAt: null,
  connectExpiresAt: null,
  connectedAt: null,
  endedAt: null,
  endedBy: null,
  endReason: null,
  revision: '1',
};

const SNAPSHOT = {
  call: CALL,
  participants: [],
  capabilities: { canAnswer: true, canCancel: false, canJoin: false, canEnd: false, belongsToThisSession: false },
  availability: { callingEnabled: true, nativeBackgroundEnabled: false },
  serverTime: '2026-11-12T00:00:00.000Z',
  cleanupState: 'not_required' as const,
};

test('accepts a live call for the active account', async () => {
  jest.mocked(fetchCallSnapshot).mockResolvedValue(SNAPSHOT);
  await expect(validateCallNotification(CALL.callId, CALL.calleeId)).resolves.toBe(true);
});

test('rejects terminal, malformed and wrong-account taps', async () => {
  jest.mocked(fetchCallSnapshot).mockResolvedValue({ ...SNAPSHOT, call: { ...CALL, status: 'cancelled', endedAt: '2026-11-12T00:00:01.000Z', endReason: 'cancelled' } });
  await expect(validateCallNotification(CALL.callId, CALL.calleeId)).resolves.toBe(false);
  await expect(validateCallNotification('not-a-uuid', CALL.calleeId)).resolves.toBe(false);
  jest.mocked(fetchCallSnapshot).mockResolvedValue(SNAPSHOT);
  await expect(validateCallNotification(CALL.callId, '55555555-5555-4555-8555-555555555555')).resolves.toBe(false);
  jest.mocked(fetchCallSnapshot).mockResolvedValue({
    ...SNAPSHOT,
    serverTime: '2026-11-12T00:01:00.000Z',
  });
  await expect(validateCallNotification(CALL.callId, CALL.calleeId)).resolves.toBe(false);
});
