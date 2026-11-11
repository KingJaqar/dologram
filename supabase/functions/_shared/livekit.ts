import {
  AccessToken,
  RoomServiceClient,
  TokenVerifier,
  TrackSource,
} from 'npm:livekit-server-sdk@2.19.3';
import { providerError, type JsonObject } from './http.ts';

export type LiveKitConfig = {
  clientUrl: string;
  serviceUrl: string;
  apiKey: string;
  apiSecret: string;
};

export type ProviderObservation =
  | { observed_at: string; result: 'unknown'; error_code: 'timeout' | 'unavailable' }
  | { observed_at: string; result: 'missing' }
  | { observed_at: string; result: 'present'; room_sid: string; participants: Array<{ identity: string; participant_sid: string }> };

export type CleanupResult = { outcome: 'confirmed' | 'retryable' | 'failed'; errorCode?: string };

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw providerError();
  return value;
}

export function liveKitConfig(): LiveKitConfig {
  const configuredUrl = required('LIVEKIT_URL').replace(/\/$/, '');
  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw providerError();
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'wss:') throw providerError();
  const path = parsed.pathname === '/' ? '' : parsed.pathname;
  const serviceUrl = parsed.protocol === 'wss:' ? `https://${parsed.host}${path}` : configuredUrl;
  const clientUrl = parsed.protocol === 'https:' ? `wss://${parsed.host}${path}` : configuredUrl;
  return {
    clientUrl,
    serviceUrl,
    apiKey: required('LIVEKIT_API_KEY'),
    apiSecret: required('LIVEKIT_API_SECRET'),
  };
}

export function roomService(config: LiveKitConfig): RoomServiceClient {
  return new RoomServiceClient(config.serviceUrl, config.apiKey, config.apiSecret, {
    requestTimeout: 5,
    failover: false,
  });
}

function errorDetails(error: unknown): { status?: number; message: string } {
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const status = typeof record.status === 'number'
      ? record.status
      : typeof record.statusCode === 'number' ? record.statusCode : undefined;
    const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';
    return { status, message };
  }
  return { message: '' };
}

export function isNotFound(error: unknown): boolean {
  const details = errorDetails(error);
  return details.status === 404 || details.message.includes('not found') || details.message.includes('does not exist');
}

function isConflict(error: unknown): boolean {
  const details = errorDetails(error);
  return details.status === 409 || details.message.includes('already exists') || details.message.includes('already started');
}

export async function provisionRoom(
  service: RoomServiceClient,
  roomName: string,
): Promise<{ sid: string }> {
  try {
    const room = await service.createRoom({
      name: roomName,
      maxParticipants: 2,
      emptyTimeout: 60,
      departureTimeout: 20,
    });
    if (!room.sid) throw providerError();
    return { sid: room.sid };
  } catch (error) {
    if (!isConflict(error) && !isNotFound(error)) {
      try {
        const rooms = await service.listRooms([roomName]);
        const existing = rooms.find((room) => room.name === roomName && room.sid.length > 0);
        if (existing) return { sid: existing.sid };
      } catch {
        // The original provider failure is the useful classification; the lookup
        // is only for a lost create response and must not expose SDK details.
      }
    }
    if (isConflict(error)) {
      try {
        const rooms = await service.listRooms([roomName]);
        const existing = rooms.find((room) => room.name === roomName && room.sid.length > 0);
        if (existing) return { sid: existing.sid };
      } catch {
        // Fall through to the bounded provider error.
      }
    }
    throw providerError();
  }
}

export async function signAdmissionToken(
  config: LiveKitConfig,
  roomName: string,
  identity: string,
  mediaType: 'voice' | 'video',
): Promise<{ token: string; nbf: bigint; exp: bigint }> {
  const token = new AccessToken(config.apiKey, config.apiSecret, { identity, ttl: 300 });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
    roomAdmin: false,
    roomCreate: false,
    roomList: false,
    roomRecord: false,
    canPublishSources: mediaType === 'voice'
      ? [TrackSource.MICROPHONE]
      : [TrackSource.MICROPHONE, TrackSource.CAMERA],
  });
  const jwt = await token.toJwt();
  const claims = await new TokenVerifier(config.apiKey, config.apiSecret).verify(jwt);
  if (typeof claims.nbf !== 'number' || typeof claims.exp !== 'number'
    || !Number.isSafeInteger(claims.nbf) || !Number.isSafeInteger(claims.exp)
    || claims.exp <= claims.nbf || claims.exp - claims.nbf > 300) {
    throw providerError();
  }
  return { token: jwt, nbf: BigInt(claims.nbf), exp: BigInt(claims.exp) };
}

export async function observeRoom(
  service: RoomServiceClient,
  roomName: string,
  roomSid: string,
): Promise<ProviderObservation> {
  const observedAt = new Date().toISOString();
  try {
    const participants = await service.listParticipants(roomName);
    return {
      observed_at: observedAt,
      result: 'present',
      room_sid: roomSid,
      participants: participants.map((participant) => ({
        identity: participant.identity,
        participant_sid: participant.sid,
      })),
    };
  } catch (error) {
    if (isNotFound(error)) return { observed_at: observedAt, result: 'missing' };
    return { observed_at: observedAt, result: 'unknown', error_code: 'unavailable' };
  }
}

function providerErrorCode(error: unknown): string {
  const details = errorDetails(error);
  if (details.status === 429) return 'quota';
  if (details.status === 401 || details.status === 403) return 'authorization';
  if (details.status === 408 || details.message.includes('timeout')) return 'timeout';
  return 'provider_error';
}

export async function cleanupRoom(
  service: RoomServiceClient,
  roomName: string,
  callerIdentity: string,
  calleeIdentity: string,
  maxFinalizedNbf: string,
  outstandingOperationUntil: string | null,
): Promise<CleanupResult> {
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  if (outstandingOperationUntil && Date.parse(outstandingOperationUntil) > Date.now()) {
    return { outcome: 'retryable', errorCode: 'provisioning_pending' };
  }
  let latestNbf: bigint;
  try {
    latestNbf = BigInt(maxFinalizedNbf);
  } catch {
    return { outcome: 'failed', errorCode: 'invalid_token_metadata' };
  }
  const revokeTokenTs = latestNbf >= nowSeconds ? latestNbf + 1n : nowSeconds + 1n;
  if (revokeTokenTs > nowSeconds + 60n) {
    return { outcome: 'failed', errorCode: 'revocation_cutoff_out_of_window' };
  }

  const removals = await Promise.allSettled([
    service.removeParticipant(roomName, callerIdentity, { revokeTokenTs }),
    service.removeParticipant(roomName, calleeIdentity, { revokeTokenTs }),
  ]);
  const failedRemoval = removals.find((result) => result.status === 'rejected' && !isNotFound(result.reason));
  if (failedRemoval && failedRemoval.status === 'rejected') {
    return { outcome: 'retryable', errorCode: providerErrorCode(failedRemoval.reason) };
  }

  try {
    await service.deleteRoom(roomName);
    return { outcome: 'confirmed' };
  } catch (error) {
    if (isNotFound(error)) return { outcome: 'confirmed' };
    return { outcome: 'retryable', errorCode: providerErrorCode(error) };
  }
}

export function webhookFields(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null) throw providerError('CALL_INVALID_REQUEST', false);
  return value as JsonObject;
}
