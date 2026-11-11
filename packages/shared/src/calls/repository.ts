import { classifyError } from '../errors';
import type { DgClient } from '../db/client';
import type { Tables } from '../db/database.types';
import type { DgResult } from '../db/result';
import { CALL_HISTORY_PAGE_SIZE, type CallHistoryCursor, type CallHistoryPage, type CallHistoryRow } from './types';

type CallRow = Tables<'calls'>;

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const POSTGRES_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function toCallState(row: CallRow): CallHistoryRow {
  return {
    callId: row.call_id,
    chatId: row.chat_id,
    callerId: row.caller_id,
    calleeId: row.callee_id,
    mediaType: row.media_type as CallHistoryRow['mediaType'],
    status: row.status as CallHistoryRow['status'],
    createdAt: row.created_at,
    ringExpiresAt: row.ring_expires_at,
    acceptedAt: row.accepted_at,
    connectExpiresAt: row.connect_expires_at,
    connectedAt: row.connected_at,
    endedAt: row.ended_at,
    endedBy: row.ended_by,
    endReason: row.end_reason as CallHistoryRow['endReason'],
    revision: String(row.revision),
  };
}

/** Reads the server-backed, participant-scoped call history with a strict tuple cursor. */
export async function listCallHistory(
  client: DgClient,
  chatId: string,
  cursor?: CallHistoryCursor,
): Promise<DgResult<CallHistoryPage>> {
  if (!UUID.test(chatId) || (cursor && (
    !UUID.test(cursor.callId) ||
    !POSTGRES_TIMESTAMP.test(cursor.createdAt) ||
    !Number.isFinite(Date.parse(cursor.createdAt))
  ))) {
    return { data: null, error: { kind: 'server', code: 'CALL_INVALID_REQUEST', status: 400 } };
  }

  let query = client
    .from('calls')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .order('call_id', { ascending: false })
    .limit(CALL_HISTORY_PAGE_SIZE + 1);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},call_id.lt.${cursor.callId})`,
    );
  }

  const { data, error, status } = await query;
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }

  const rows = data.slice(0, CALL_HISTORY_PAGE_SIZE).map(toCallState);
  const last = rows.at(-1);
  return {
    data: {
      rows,
      nextCursor: last && data.length > CALL_HISTORY_PAGE_SIZE
        ? { createdAt: last.createdAt, callId: last.callId }
        : null,
    },
    error: null,
  };
}

