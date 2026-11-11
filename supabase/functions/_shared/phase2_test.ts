import { strict as assert } from 'node:assert';
import type { RoomServiceClient } from 'npm:livekit-server-sdk@2.19.3';
import { TokenVerifier } from 'npm:livekit-server-sdk@2.19.3';
import { ensureReadyAdmission } from './admission.ts';
import { parseActionInput, parseTokenInput } from './calling.ts';
import { CallHttpError, readJsonBody } from './http.ts';
import { cleanupRoom, liveKitConfig, observeRoom, provisionRoom, signAdmissionToken } from './livekit.ts';

const config = {
  clientUrl: 'wss://phase-two.invalid',
  serviceUrl: 'https://phase-two.invalid',
  apiKey: 'phase-two-key',
  apiSecret: 'phase-two-secret-for-contract-tests',
};

function roomServiceStub(value: Record<string, unknown>): RoomServiceClient {
  return value as unknown as RoomServiceClient;
}

Deno.test('signs least-privilege five-minute voice and video grants', async () => {
  for (const mediaType of ['voice', 'video'] as const) {
    const signed = await signAdmissionToken(config, 'opaque-room', 'opaque-participant', mediaType);
    const claims = await new TokenVerifier(config.apiKey, config.apiSecret).verify(signed.token);
    if (typeof claims.exp !== 'number' || typeof claims.nbf !== 'number') throw new Error('missing token times');
    assert.equal(claims.exp - claims.nbf, 300);
    assert.equal(claims.sub, 'opaque-participant');
    assert.equal(claims.video?.room, 'opaque-room');
    assert.equal(claims.video?.roomJoin, true);
    assert.equal(claims.video?.canPublishData, false);
    assert.equal(claims.video?.canUpdateOwnMetadata, false);
    assert.equal(JSON.stringify(claims.video?.canPublishSources), JSON.stringify(
      mediaType === 'voice' ? ['microphone'] : ['microphone', 'camera'],
    ));
  }
});

Deno.test('recovers a lost room-create response by looking up the immutable room name', async () => {
  let createAttempts = 0;
  const service = roomServiceStub({
    createRoom: async () => {
      createAttempts += 1;
      throw new Error('provider timeout');
    },
    listRooms: async () => [{ name: 'opaque-room', sid: 'RM_RECOVERED' }],
  });
  const room = await provisionRoom(service, 'opaque-room');
  assert.equal(createAttempts, 1);
  assert.equal(room.sid, 'RM_RECOVERED');
});

Deno.test('cleanup revokes newer credentials with a current seconds cutoff before deleting', async () => {
  const calls: Array<{ identity: string; revokeTokenTs: bigint }> = [];
  let deleted = 0;
  const service = roomServiceStub({
    removeParticipant: async (_room: string, identity: string, options: { revokeTokenTs?: bigint }) => {
      if (options.revokeTokenTs === undefined) throw new Error('missing cutoff');
      calls.push({ identity, revokeTokenTs: options.revokeTokenTs });
    },
    deleteRoom: async () => { deleted += 1; },
  });
  const oldNbf = Math.floor(Date.now() / 1000) - 300;
  const result = await cleanupRoom(service, 'opaque-room', 'caller', 'callee', String(oldNbf), null);
  assert.deepEqual(result, { outcome: 'confirmed' });
  assert.equal(deleted, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].revokeTokenTs, calls[1].revokeTokenTs);
  assert.ok(calls[0].revokeTokenTs > BigInt(oldNbf));
  assert.ok(calls[0].revokeTokenTs <= BigInt(Math.floor(Date.now() / 1000) + 60));
});

Deno.test('does not report cleanup confirmed while room provisioning is still outstanding', async () => {
  let removed = false;
  const service = roomServiceStub({
    removeParticipant: async () => { removed = true; },
    deleteRoom: async () => undefined,
  });
  const result = await cleanupRoom(
    service,
    'opaque-room',
    'caller',
    'callee',
    '0',
    new Date(Date.now() + 30_000).toISOString(),
  );
  assert.deepEqual(result, { outcome: 'retryable', errorCode: 'provisioning_pending' });
  assert.equal(removed, false);
});

Deno.test('re-reads a ready admission after a concurrent provisioning finalizer wins', async () => {
  const calls: string[] = [];
  const initial = {
    admission_id: null,
    epoch: '4',
    lease_expires_at: null,
    room_name: 'call-room-race',
    room_sid: null,
    room_generation: '1',
    participant_identity: 'caller',
    media_type: 'voice' as const,
    readiness: 'provisioning' as const,
    operation_id: '10000000-0000-4000-8000-000000000001',
    operation_lease_expires_at: null,
    revision: '3',
    server_time: '2026-11-11T00:00:00.000Z',
  };
  const ready = { ...initial, readiness: 'ready' as const, room_sid: 'RM_RACE' };

  const result = await ensureReadyAdmission(
    initial,
    async (roomName) => {
      calls.push(`provision:${roomName}`);
      return { sid: 'RM_RACE' };
    },
    async (input) => {
      calls.push(`finalize:${input.operationId}`);
      return null;
    },
    async () => {
      calls.push('prepare');
      return ready;
    },
    '20000000-0000-4000-8000-000000000001',
  );

  assert.equal(result.readiness, 'ready');
  assert.equal(result.room_sid, 'RM_RACE');
  assert.deepEqual(calls, [
    'provision:call-room-race',
    'finalize:10000000-0000-4000-8000-000000000001',
    'prepare',
  ]);
});

Deno.test('classifies a provider room absence as missing for reconciliation', async () => {
  const service = roomServiceStub({
    listParticipants: async () => { throw new Error('room not found'); },
  });
  const observation = await observeRoom(service, 'opaque-room', 'RM_STALE');
  assert.equal(observation.result, 'missing');
});

Deno.test('rejects malformed or expanded client contracts before RPC use', async () => {
  assert.deepEqual(parseTokenInput({
    callId: '11111111-1111-4111-8111-111111111111',
    clientSessionId: '22222222-2222-4222-8222-222222222222',
  }), {
    callId: '11111111-1111-4111-8111-111111111111',
    clientSessionId: '22222222-2222-4222-8222-222222222222',
  });
  assert.throws(() => parseActionInput({
    action: 'create',
    chatId: '11111111-1111-4111-8111-111111111111',
    mediaType: 'voice',
    requestId: '22222222-2222-4222-8222-222222222222',
    clientSessionId: '33333333-3333-4333-8333-333333333333',
    roomName: 'forbidden',
  }), CallHttpError);
  assert.throws(() => parseTokenInput({
    callId: '00000000-0000-0000-0000-000000000000',
    clientSessionId: '22222222-2222-4222-8222-222222222222',
  }), CallHttpError);
});

Deno.test('enforces the measured request body limit', async () => {
  const oversized = new Request('https://example.invalid', {
    method: 'POST',
    body: JSON.stringify({ value: 'x'.repeat(8_200) }),
  });
  await assert.rejects(() => readJsonBody(oversized), (error: unknown) =>
    error instanceof CallHttpError && error.code === 'CALL_INVALID_REQUEST');
});

Deno.test('normalizes the configured LiveKit service and client URLs', () => {
  const original = Deno.env.get('LIVEKIT_URL');
  const originalKey = Deno.env.get('LIVEKIT_API_KEY');
  const originalSecret = Deno.env.get('LIVEKIT_API_SECRET');
  try {
    Deno.env.set('LIVEKIT_URL', 'https://project.livekit.cloud');
    Deno.env.set('LIVEKIT_API_KEY', 'key');
    Deno.env.set('LIVEKIT_API_SECRET', 'secret');
    assert.deepEqual(liveKitConfig(), {
      clientUrl: 'wss://project.livekit.cloud',
      serviceUrl: 'https://project.livekit.cloud',
      apiKey: 'key',
      apiSecret: 'secret',
    });
  } finally {
    if (original === undefined) Deno.env.delete('LIVEKIT_URL'); else Deno.env.set('LIVEKIT_URL', original);
    if (originalKey === undefined) Deno.env.delete('LIVEKIT_API_KEY'); else Deno.env.set('LIVEKIT_API_KEY', originalKey);
    if (originalSecret === undefined) Deno.env.delete('LIVEKIT_API_SECRET'); else Deno.env.set('LIVEKIT_API_SECRET', originalSecret);
  }
});
