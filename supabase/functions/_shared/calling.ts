import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';
import type { CallSnapshot } from '../../../packages/shared/src/calls/types.ts';
import {
  CallHttpError,
  exactKeys,
  isObject,
  jsonResponse,
  providerError,
  requireString,
  requireUuid,
  type JsonObject,
} from './http.ts';

export type CallingClient = SupabaseClient;

export type AuthContext = {
  actorId: string;
  admin: CallingClient;
};

export type CallActionInput =
  | { action: 'create'; chatId: string; mediaType: 'voice' | 'video'; requestId: string; clientSessionId: string }
  | { action: 'accept' | 'decline' | 'cancel' | 'end'; callId: string; requestId: string; clientSessionId: string }
  | { action: 'snapshot'; clientSessionId: string; callId?: string };

export type AdmissionPreparation = {
  admission_id: string | null;
  epoch: string;
  lease_expires_at: string | null;
  room_name: string;
  room_sid: string | null;
  room_generation: string;
  participant_identity: string;
  media_type: 'voice' | 'video';
  readiness: 'unprovisioned' | 'provisioning' | 'ready';
  operation_id: string | null;
  operation_lease_expires_at: string | null;
  revision: string;
  server_time: string;
};

export type AdmissionFinalization = {
  authorized: boolean;
  revision: string | null;
  server_time: string;
};

export type WorkerJob = {
  kind: 'reconcile' | 'cleanup';
  job_id: string;
  call_id: string | null;
  lease_id: string;
  room_generation: string;
  termination_epoch: string;
  room_name: string;
  room_sid: string | null;
  caller_identity: string;
  callee_identity: string;
  max_finalized_nbf: string;
  max_finalized_exp: string;
  outstanding_operation_until: string | null;
};

const knownRpcCodes = new Set([
  'CALL_ALREADY_HANDLED', 'CALL_BUSY', 'CALL_EXPIRED', 'CALL_FEATURE_DISABLED',
  'CALL_INVALID_REQUEST', 'CALL_NOT_ALLOWED', 'CALL_NOT_FOUND', 'CALL_PROVIDER_UNAVAILABLE',
  'CALL_RATE_LIMITED', 'CALL_REQUEST_CONFLICT',
]);

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw providerError('CALL_PROVIDER_UNAVAILABLE', true);
  return value;
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new CallHttpError(401, 'CALL_UNAUTHENTICATED', false);
  const token = header.slice('Bearer '.length).trim();
  if (token.length === 0 || token.length > 16_384) {
    throw new CallHttpError(401, 'CALL_UNAUTHENTICATED', false);
  }
  return token;
}

export function createAdminClient(): CallingClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function authenticate(request: Request): Promise<AuthContext> {
  const token = bearerToken(request);
  const authClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) throw new CallHttpError(401, 'CALL_UNAUTHENTICATED', false);
  return { actorId: requireUuid(data.user.id), admin: createAdminClient() };
}

function rpcCode(error: unknown): string | null {
  if (!isObject(error) || typeof error.message !== 'string') return null;
  const match = error.message.match(/CALL_[A-Z_]+/);
  return match && knownRpcCodes.has(match[0]) ? match[0] : null;
}

function rpcHttpError(error: unknown): CallHttpError {
  const code = rpcCode(error);
  if (code === 'CALL_NOT_FOUND') return new CallHttpError(404, code, false);
  if (code === 'CALL_NOT_ALLOWED') return new CallHttpError(403, code, false);
  if (code === 'CALL_INVALID_REQUEST') return new CallHttpError(400, code, false);
  if (code === 'CALL_RATE_LIMITED') return new CallHttpError(429, code, true, 5);
  if (code === 'CALL_FEATURE_DISABLED') return new CallHttpError(503, code, false);
  if (code === 'CALL_BUSY' || code === 'CALL_EXPIRED' || code === 'CALL_ALREADY_HANDLED' || code === 'CALL_REQUEST_CONFLICT') {
    return new CallHttpError(409, code, false);
  }
  return providerError();
}

export async function rpc<T>(client: CallingClient, functionName: string, args: JsonObject): Promise<T> {
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw rpcHttpError(error);
  return data as T;
}

const statuses = new Set(['ringing', 'accepted', 'in_progress', 'declined', 'cancelled', 'missed', 'ended', 'failed']);
const reasons = new Set([
  'declined', 'cancelled', 'no_answer', 'busy', 'hangup', 'connection_timeout',
  'media_disconnected', 'permission_denied', 'provider_error', 'access_lost',
  'account_restricted', 'max_duration', 'feature_disabled',
]);

function validTimestamp(value: unknown, nullable = true): value is string | null {
  return value === null ? nullable : typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validCall(value: unknown): boolean {
  if (!isObject(value)) return false;
  return typeof value.callId === 'string' && typeof value.chatId === 'string'
    && typeof value.callerId === 'string' && typeof value.calleeId === 'string'
    && (value.mediaType === 'voice' || value.mediaType === 'video')
    && typeof value.status === 'string' && statuses.has(value.status)
    && validTimestamp(value.createdAt, false) && validTimestamp(value.ringExpiresAt, false)
    && validTimestamp(value.acceptedAt) && validTimestamp(value.connectExpiresAt)
    && validTimestamp(value.connectedAt) && validTimestamp(value.endedAt)
    && (value.endedBy === null || typeof value.endedBy === 'string')
    && (value.endReason === null || (typeof value.endReason === 'string' && reasons.has(value.endReason)))
    && typeof value.revision === 'string' && /^\d+$/.test(value.revision);
}

export function parseSnapshot(value: unknown): CallSnapshot {
  if (!isObject(value) || !(value.call === null || validCall(value.call))
    || !Array.isArray(value.participants)
    || !isObject(value.capabilities)
    || typeof value.capabilities.canAnswer !== 'boolean'
    || typeof value.capabilities.canCancel !== 'boolean'
    || typeof value.capabilities.canJoin !== 'boolean'
    || typeof value.capabilities.canEnd !== 'boolean'
    || typeof value.capabilities.belongsToThisSession !== 'boolean'
    || !isObject(value.availability) || typeof value.availability.callingEnabled !== 'boolean'
    || !validTimestamp(value.serverTime, false)
    || !['not_required', 'pending', 'confirmed', 'failed'].includes(String(value.cleanupState))) {
    throw providerError('CALL_PROVIDER_UNAVAILABLE', true);
  }
  return value as unknown as CallSnapshot;
}

export function parseActionInput(body: JsonObject): CallActionInput {
  const action = requireString(body.action, 16);
  if (action === 'create') {
    exactKeys(body, ['action', 'chatId', 'mediaType', 'requestId', 'clientSessionId']);
    const mediaType = requireString(body.mediaType, 5);
    if (mediaType !== 'voice' && mediaType !== 'video') throw new CallHttpError(400, 'CALL_INVALID_REQUEST', false);
    return {
      action,
      chatId: requireUuid(body.chatId),
      mediaType,
      requestId: requireUuid(body.requestId),
      clientSessionId: requireUuid(body.clientSessionId),
    };
  }
  if (action === 'snapshot') {
    exactKeys(body, ['action', 'clientSessionId'], ['callId']);
    return {
      action,
      clientSessionId: requireUuid(body.clientSessionId),
      ...(body.callId === undefined ? {} : { callId: requireUuid(body.callId) }),
    };
  }
  if (action === 'accept' || action === 'decline' || action === 'cancel' || action === 'end') {
    exactKeys(body, ['action', 'callId', 'requestId', 'clientSessionId']);
    return { action, callId: requireUuid(body.callId), requestId: requireUuid(body.requestId), clientSessionId: requireUuid(body.clientSessionId) };
  }
  throw new CallHttpError(400, 'CALL_INVALID_REQUEST', false);
}

export function parseTokenInput(body: JsonObject): { callId: string; clientSessionId: string } {
  exactKeys(body, ['callId', 'clientSessionId']);
  return { callId: requireUuid(body.callId), clientSessionId: requireUuid(body.clientSessionId) };
}

function optionalUuid(value: unknown): string | null {
  return value === null ? null : requireUuid(value);
}

function optionalTimestamp(value: unknown): string | null {
  if (value === null) return null;
  const result = requireString(value, 64);
  if (!Number.isFinite(Date.parse(result))) throw providerError();
  return result;
}

export function parseAdmission(value: unknown): AdmissionPreparation {
  if (!isObject(value)
    || (value.admission_id !== null && typeof value.admission_id !== 'string')
    || typeof value.epoch !== 'string' || !/^\d+$/.test(value.epoch)
    || (value.lease_expires_at !== null && typeof value.lease_expires_at !== 'string')
    || typeof value.room_name !== 'string' || value.room_name.length === 0
    || (value.room_sid !== null && typeof value.room_sid !== 'string')
    || typeof value.room_generation !== 'string' || !/^\d+$/.test(value.room_generation)
    || typeof value.participant_identity !== 'string' || value.participant_identity.length === 0
    || (value.media_type !== 'voice' && value.media_type !== 'video')
    || !['unprovisioned', 'provisioning', 'ready'].includes(String(value.readiness))
    || (value.operation_id !== null && typeof value.operation_id !== 'string')
    || (value.operation_lease_expires_at !== null && typeof value.operation_lease_expires_at !== 'string')
    || typeof value.revision !== 'string' || !/^\d+$/.test(value.revision)
    || typeof value.server_time !== 'string' || !Number.isFinite(Date.parse(value.server_time))) {
    throw providerError();
  }
  return {
    admission_id: optionalUuid(value.admission_id),
    epoch: value.epoch,
    lease_expires_at: optionalTimestamp(value.lease_expires_at),
    room_name: value.room_name,
    room_sid: value.room_sid,
    room_generation: value.room_generation,
    participant_identity: value.participant_identity,
    media_type: value.media_type,
    readiness: value.readiness as AdmissionPreparation['readiness'],
    operation_id: optionalUuid(value.operation_id),
    operation_lease_expires_at: optionalTimestamp(value.operation_lease_expires_at),
    revision: value.revision,
    server_time: value.server_time,
  };
}

export function parseAdmissionFinalization(value: unknown): AdmissionFinalization {
  if (!isObject(value) || typeof value.authorized !== 'boolean'
    || (value.revision !== null && (typeof value.revision !== 'string' || !/^\d+$/.test(value.revision)))
    || typeof value.server_time !== 'string' || !Number.isFinite(Date.parse(value.server_time))) {
    throw providerError();
  }
  return { authorized: value.authorized, revision: value.revision, server_time: value.server_time };
}

export function parseWorkerJobs(value: unknown): WorkerJob[] {
  if (!Array.isArray(value)) throw providerError();
  return value.map((item) => {
    if (!isObject(item)
      || (item.kind !== 'reconcile' && item.kind !== 'cleanup')
      || typeof item.job_id !== 'string' || !requireUuid(item.job_id)
      || (item.call_id !== null && typeof item.call_id !== 'string')
      || typeof item.lease_id !== 'string' || !requireUuid(item.lease_id)
      || typeof item.room_generation !== 'string' || !/^\d+$/.test(item.room_generation)
      || typeof item.termination_epoch !== 'string' || !/^\d+$/.test(item.termination_epoch)
      || typeof item.room_name !== 'string' || item.room_name.length === 0
      || (item.room_sid !== null && typeof item.room_sid !== 'string')
      || typeof item.caller_identity !== 'string' || typeof item.callee_identity !== 'string'
      || typeof item.max_finalized_nbf !== 'string' || !/^\d+$/.test(item.max_finalized_nbf)
      || typeof item.max_finalized_exp !== 'string' || !/^\d+$/.test(item.max_finalized_exp)
      || (item.outstanding_operation_until !== null && typeof item.outstanding_operation_until !== 'string')) {
      throw providerError();
    }
    return {
      kind: item.kind,
      job_id: item.job_id,
      call_id: item.call_id,
      lease_id: item.lease_id,
      room_generation: item.room_generation,
      termination_epoch: item.termination_epoch,
      room_name: item.room_name,
      room_sid: item.room_sid,
      caller_identity: item.caller_identity,
      callee_identity: item.callee_identity,
      max_finalized_nbf: item.max_finalized_nbf,
      max_finalized_exp: item.max_finalized_exp,
      outstanding_operation_until: item.outstanding_operation_until,
    };
  });
}

export function callSnapshotResponse(snapshot: unknown): Response {
  return jsonResponse(parseSnapshot(snapshot));
}

export function busyOrSnapshot(snapshot: CallSnapshot): Response {
  if (snapshot.call?.status === 'failed' && snapshot.call.endReason === 'busy') {
    return jsonResponse({
      code: 'CALL_BUSY',
      message: 'The other person is busy.',
      retryable: false,
      call: snapshot.call,
    }, 409);
  }
  return jsonResponse(snapshot);
}
