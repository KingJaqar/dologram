// Phase 0 public SDK contract probes only. No network requests or real credentials.
import {
  AccessToken,
  RoomServiceClient,
  TokenVerifier,
  TrackSource,
  WebhookReceiver,
} from 'npm:livekit-server-sdk@2.19.3';

const key = 'phase-zero-synthetic-key';
const secret = 'phase-zero-synthetic-signing-input-for-offline-tests';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

for (const media of ['voice', 'video'] as const) {
  Deno.test(`five-minute ${media} source and room grants`, async () => {
    const token = new AccessToken(key, secret, { identity: 'opaque-participant', ttl: 300 });
    token.addGrant({
      room: 'opaque-room', roomJoin: true, canPublish: true, canSubscribe: true,
      canPublishData: false, canUpdateOwnMetadata: false,
      roomAdmin: false, roomCreate: false, roomList: false, roomRecord: false,
      canPublishSources: media === 'voice'
        ? [TrackSource.MICROPHONE] : [TrackSource.MICROPHONE, TrackSource.CAMERA],
    });
    const claims = await new TokenVerifier(key, secret).verify(await token.toJwt());
    assert(typeof claims.exp === 'number' && typeof claims.nbf === 'number', 'Missing times');
    assert(claims.exp - claims.nbf === 300, 'Initial TTL must be 300 seconds');
    assert(claims.sub === 'opaque-participant', 'Identity changed');
    const grant = claims.video;
    assert(grant?.room === 'opaque-room' && grant.roomJoin === true, 'Room scope changed');
    // The verifier exposes the serialized JWT sources as strings at runtime.
    assert(JSON.stringify(grant.canPublishSources) === JSON.stringify(
      media === 'voice' ? ['microphone'] : ['microphone', 'camera'],
    ), 'Unexpected source serialization');
    assert(grant.canPublishData === false && grant.canUpdateOwnMetadata === false, 'Extra grants');
    assert(grant.roomAdmin === false && grant.roomCreate === false &&
      grant.roomList === false && grant.roomRecord === false, 'Privileged grant');
  });
}

Deno.test('removal serializes a seconds bigint cutoff and uses a bounded request', async () => {
  const originalFetch = globalThis.fetch;
  const cutoff = BigInt(Math.floor(Date.now() / 1000) + 1);
  let requests = 0;
  globalThis.fetch = async (input, init) => {
    requests++;
    assert(String(input) === 'https://phase-zero.invalid/twirp/livekit.RoomService/RemoveParticipant',
      'Unexpected endpoint');
    assert(typeof init?.body === 'string', 'Expected JSON body');
    const body: unknown = JSON.parse(init.body);
    assert(typeof body === 'object' && body !== null && 'room' in body &&
      body.room === 'opaque-room' && 'identity' in body && body.identity === 'opaque-participant' &&
      'revokeTokenTs' in body && body.revokeTokenTs === String(cutoff), 'Removal payload changed');
    assert(init.signal instanceof AbortSignal, 'Missing timeout signal');
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const service = new RoomServiceClient('https://phase-zero.invalid', key, secret,
      { requestTimeout: 5, failover: false });
    await service.removeParticipant('opaque-room', 'opaque-participant', { revokeTokenTs: cutoff });
    assert(requests === 1, 'Unexpected automatic retries');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('webhook verification rejects a modified raw body', async () => {
  const body = JSON.stringify({ event: 'room_started', id: 'phase-zero-event' });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const signed = new AccessToken(key, secret, { ttl: 300 });
  signed.sha256 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  const header = await signed.toJwt();
  const receiver = new WebhookReceiver(key, secret);
  const event = await receiver.receive(body, header);
  assert(event.id === 'phase-zero-event', 'Unexpected decoded event');
  let rejected = false;
  try {
    await receiver.receive(body + ' ', header);
  } catch {
    rejected = true;
  }
  assert(rejected, 'Tampered body was accepted');
});
