import { classifyError, type ClassifiedError } from '../../errors';
import type { DgClient } from '../client';
import type { Json } from '../database.types';
import type { DgResult } from '../result';

export type ReadTimeVisibility = 'everyone' | 'nobody';

export type ReadParticipant = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  read_at: string | null;
};

export type ReadDetailsResult =
  | { state: 'available'; participants: ReadParticipant[]; expires_at: string }
  | {
    state:
      | 'expired'
      | 'not_available_for_large_group'
      | 'not_recorded'
      | 'hidden'
      | 'not_found';
  };

function contractError(): ClassifiedError {
  return { kind: 'server', code: null, status: 502 };
}

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: Json | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function parseParticipant(value: Json): ReadParticipant | null {
  if (!isRecord(value)) return null;
  if (typeof value.user_id !== 'string' || value.user_id.length === 0) return null;
  if (typeof value.display_name !== 'string' || value.display_name.length === 0) return null;
  if (value.avatar_url !== null && typeof value.avatar_url !== 'string') return null;
  if (value.read_at !== null && !isTimestamp(value.read_at)) return null;
  return {
    user_id: value.user_id,
    display_name: value.display_name,
    avatar_url: value.avatar_url,
    read_at: value.read_at,
  };
}

function parseReadDetails(value: Json): ReadDetailsResult | null {
  if (!isRecord(value) || typeof value.state !== 'string') return null;
  if (value.state !== 'available') {
    if (
      value.state === 'expired'
      || value.state === 'not_available_for_large_group'
      || value.state === 'not_recorded'
      || value.state === 'hidden'
      || value.state === 'not_found'
    ) {
      return { state: value.state };
    }
    return null;
  }

  if (!Array.isArray(value.participants) || !isTimestamp(value.expires_at)) return null;
  const participants: ReadParticipant[] = [];
  const userIds = new Set<string>();
  for (const candidate of value.participants) {
    const participant = parseParticipant(candidate);
    if (participant === null || userIds.has(participant.user_id)) return null;
    userIds.add(participant.user_id);
    participants.push(participant);
  }
  return { state: 'available', participants, expires_at: value.expires_at };
}

export async function getMessageReadParticipants(
  client: DgClient,
  chatId: string,
  messageId: string,
): Promise<DgResult<ReadDetailsResult>> {
  if (chatId.length === 0 || messageId.length === 0) {
    return { data: null, error: { kind: 'server', code: 'DG422', status: 400 } };
  }

  const { data, error, status } = await client.rpc('get_message_read_participants', {
    p_chat_id: chatId,
    p_message_id: messageId,
  });
  if (error) return { data: null, error: classifyError(error, status) };

  const parsed = parseReadDetails(data);
  return parsed === null
    ? { data: null, error: contractError() }
    : { data: parsed, error: null };
}

export async function getMyReadPrivacy(
  client: DgClient,
): Promise<DgResult<ReadTimeVisibility>> {
  const { data, error, status } = await client.rpc('get_my_read_privacy');
  if (error) return { data: null, error: classifyError(error, status) };
  if (data !== 'everyone' && data !== 'nobody') {
    return { data: null, error: contractError() };
  }
  return { data, error: null };
}

export async function setMyReadPrivacy(
  client: DgClient,
  visibility: ReadTimeVisibility,
): Promise<DgResult<ReadTimeVisibility>> {
  if (visibility !== 'everyone' && visibility !== 'nobody') {
    return { data: null, error: { kind: 'server', code: 'DG422', status: 400 } };
  }

  const { data, error, status } = await client.rpc('set_my_read_privacy', {
    p_read_time_visibility: visibility,
  });
  if (error) return { data: null, error: classifyError(error, status) };
  if (data !== visibility) return { data: null, error: contractError() };
  return { data, error: null };
}
