import type { CallAction, CallMediaType, CallSnapshot } from '@dologram/shared';
import { supabase } from '../lib/supabase';
import { ids } from '../lib/ids';

export class CallApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable = false) {
    super(code);
    this.name = 'CallApiError';
    this.code = code;
    this.retryable = retryable;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTimestamp(value: unknown, nullable = true): value is string | null {
  return value === null ? nullable : typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function parseSnapshot(value: unknown): CallSnapshot {
  if (!isRecord(value) || !(value.call === null || isRecord(value.call)) || !Array.isArray(value.participants)
    || !isRecord(value.capabilities) || typeof value.capabilities.canAnswer !== 'boolean'
    || typeof value.capabilities.canCancel !== 'boolean' || typeof value.capabilities.canJoin !== 'boolean'
    || typeof value.capabilities.canEnd !== 'boolean' || typeof value.capabilities.belongsToThisSession !== 'boolean'
    || !isRecord(value.availability) || typeof value.availability.callingEnabled !== 'boolean'
    || !isTimestamp(value.serverTime, false)) {
    throw new CallApiError('CALL_PROVIDER_UNAVAILABLE', true);
  }

  return value as unknown as CallSnapshot;
}

function errorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const match = message.match(/CALL_[A-Z_]+/);
  return match?.[0] ?? 'CALL_PROVIDER_UNAVAILABLE';
}

async function invoke(body: Record<string, unknown>): Promise<CallSnapshot> {
  const { data, error } = await supabase.functions.invoke('call-action', { body });
  if (error) throw new CallApiError(errorCode(error), errorCode(error) === 'CALL_PROVIDER_UNAVAILABLE');
  return parseSnapshot(data);
}

export function callRequestId(): string {
  return ids.messageId();
}

export async function createVoiceCall(chatId: string, clientSessionId: string): Promise<CallSnapshot> {
  return invoke({ action: 'create', chatId, mediaType: 'voice' satisfies CallMediaType, requestId: callRequestId(), clientSessionId });
}

export async function transitionCall(
  action: Exclude<CallAction, 'accept'> | 'accept',
  callId: string,
  clientSessionId: string,
): Promise<CallSnapshot> {
  return invoke({ action, callId, requestId: callRequestId(), clientSessionId });
}

export async function fetchCallSnapshot(clientSessionId: string, callId?: string): Promise<CallSnapshot> {
  return invoke({ action: 'snapshot', clientSessionId, ...(callId ? { callId } : {}) });
}

export type CallToken = {
  serverUrl: string;
  participantToken: string;
  expiresAt: string;
  callId: string;
  revision: string;
  serverTime: string;
};

export async function fetchCallToken(callId: string, clientSessionId: string): Promise<CallToken> {
  const { data, error } = await supabase.functions.invoke('call-token', {
    body: { callId, clientSessionId },
  });
  if (error || !isRecord(data) || typeof data.serverUrl !== 'string' || typeof data.participantToken !== 'string'
    || typeof data.expiresAt !== 'string' || typeof data.callId !== 'string' || typeof data.revision !== 'string'
    || typeof data.serverTime !== 'string') {
    throw new CallApiError(errorCode(error), errorCode(error) === 'CALL_PROVIDER_UNAVAILABLE');
  }
  return data as unknown as CallToken;
}
