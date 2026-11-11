import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database, Tables } from '../../db/database.types';
import { listCallHistory } from '../repository';

const chatId = '11111111-1111-4111-8111-111111111111';
const createdAt = '2026-11-11T12:34:56.123456+00:00';

function row(index: number): Tables<'calls'> {
  return {
    call_id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`,
    chat_id: chatId,
    caller_id: '33333333-3333-4333-8333-333333333333',
    callee_id: '44444444-4444-4444-8444-444444444444',
    request_id: '55555555-5555-4555-8555-555555555555',
    status: 'missed',
    end_reason: 'no_answer',
    media_type: 'voice',
    created_at: createdAt,
    ring_expires_at: createdAt,
    accepted_at: null,
    connect_expires_at: null,
    connected_at: null,
    ended_at: createdAt,
    ended_by: null,
    revision: 2,
  };
}

function clientWithFetch(fetch: typeof globalThis.fetch) {
  return createClient<Database>('https://example.invalid', 'local-test-key', {
    global: { fetch },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe('call history', () => {
  it('preserves microseconds and uses a strict tuple cursor for tied timestamps', async () => {
    const results = Array.from({ length: 31 }, (_, i) => row(31 - i));
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(results))
      .mockResolvedValueOnce(Response.json(results.slice(30)));
    const client = clientWithFetch(fetch);
    const first = await listCallHistory(client, chatId);
    const cursor = first.data?.nextCursor;
    expect(first.data?.rows).toHaveLength(30);
    expect(cursor).toEqual({ createdAt, callId: row(2).call_id });
    if (!cursor) throw new Error('Missing history cursor');
    const second = await listCallHistory(client, chatId, cursor);
    expect(second.data?.rows.map(({ callId }) => callId)).toEqual([row(1).call_id]);
    expect(second.data?.nextCursor).toBeNull();
    const params = new URL(String(fetch.mock.calls[1]?.[0])).searchParams;
    expect(params.get('limit')).toBe('31');
    expect(params.get('order')).toBe('created_at.desc,call_id.desc');
    expect(params.get('or')).toBe(
      `(created_at.lt.${createdAt},and(created_at.eq.${createdAt},call_id.lt.${cursor.callId}))`,
    );
  });

  it('rejects a malformed cursor before making a request', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const result = await listCallHistory(clientWithFetch(fetch), chatId, {
      createdAt: '2026-11-11,chat_id.neq.anything',
      callId: row(2).call_id,
    });
    expect(result.error).toEqual({ kind: 'server', code: 'CALL_INVALID_REQUEST', status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
