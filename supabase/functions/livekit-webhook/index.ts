import { WebhookReceiver } from 'npm:livekit-server-sdk@2.19.3';
import { createAdminClient, rpc } from '../_shared/calling.ts';
import { CallHttpError, errorResponse, jsonResponse, methodResponse, providerError, safeDiagnostic } from '../_shared/http.ts';
import { liveKitConfig } from '../_shared/livekit.ts';

const MAX_WEBHOOK_BODY_BYTES = 65_536;
const acceptedEvents = new Set([
  'room_started', 'room_finished', 'participant_joined', 'participant_left',
  'participant_connection_aborted', 'track_published', 'track_unpublished',
]);

async function readBody(request: Request): Promise<string> {
  if (!request.body) throw providerError('CALL_INVALID_REQUEST', false);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_WEBHOOK_BODY_BYTES) throw providerError('CALL_INVALID_REQUEST', false);
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

Deno.serve(async (request) => {
  const methodError = methodResponse(request);
  if (methodError) return methodError;
  try {
    const config = liveKitConfig();
    const body = await readBody(request);
    const authorization = request.headers.get('authorization') ?? undefined;
    const event = await new WebhookReceiver(config.apiKey, config.apiSecret).receive(body, authorization);
    if (!acceptedEvents.has(event.event) || !event.id || event.id.length > 128 || !event.room?.name || !event.room.sid) {
      throw providerError('CALL_INVALID_REQUEST', false);
    }
    if (event.createdAt <= 0n || event.createdAt > BigInt(Math.floor(Date.now() / 1000) + 86_400)) {
      throw providerError('CALL_INVALID_REQUEST', false);
    }
    const participantIdentity = event.participant?.identity || null;
    const participantSid = event.participant?.sid || null;
    const result = await rpc(createAdminClient(), 'call_record_webhook', {
      p_provider_event_id: event.id,
      p_event_time: new Date(Number(event.createdAt) * 1000).toISOString(),
      p_event_type: event.event,
      p_room_name: event.room.name,
      p_room_sid: event.room.sid,
      p_participant_identity: participantIdentity,
      p_participant_sid: participantSid,
    });
    return jsonResponse({ accepted: isAccepted(result), duplicate: isDuplicate(result) });
  } catch (error) {
    if (!(error instanceof CallHttpError)) {
      safeDiagnostic('webhook_rejected', { callId: null, reason: 'signature_or_provider_error' });
      return errorResponse(new CallHttpError(401, 'CALL_UNAUTHENTICATED', false));
    }
    return errorResponse(error);
  }
});

function isAccepted(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'accepted' in value && value.accepted === true;
}

function isDuplicate(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'duplicate' in value && value.duplicate === true;
}
