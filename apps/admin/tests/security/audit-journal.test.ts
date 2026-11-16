// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => {
  class AdminDbError extends Error {
    readonly code: string | undefined;
    constructor(code?: string) {
      super('Database request failed.');
      this.code = code;
    }
  }
  return { AdminDbError, writeAudit: vi.fn() };
});

vi.mock('@dologram/admin-core', () => core);

import { flushAudit, recordAudit } from '../../src/server/auditLog';
import type { AuditEvent } from '@dologram/admin-core';

const ACTOR = '10000000-0000-4000-8000-000000000001';

function event(): AuditEvent {
  return { action: 'session.unlock', actorUserId: ACTOR, result: 'success', detail: {} };
}

function recorded(): { eventId?: string; action: string; actorUserId: string | null; result: string }[] {
  return core.writeAudit.mock.calls.map(call => call[0] as { eventId?: string; action: string; actorUserId: string | null; result: string });
}

beforeEach(async () => {
  core.writeAudit.mockReset();
  core.writeAudit.mockResolvedValue(undefined);
  await flushAudit();
  core.writeAudit.mockClear();
});

describe('audit journal', () => {
  it('writes one event with a stable identity', async () => {
    await recordAudit(event());
    expect(recorded()).toHaveLength(1);
    expect(recorded()[0]).toMatchObject({ action: 'session.unlock', actorUserId: ACTOR, result: 'success' });
    expect(recorded()[0]?.eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });

  it('keeps the action working during an outage and reconciles the same event once', async () => {
    core.writeAudit.mockRejectedValue(new core.AdminDbError('08006'));
    await expect(recordAudit(event())).resolves.toBeUndefined();
    expect(recorded()).toHaveLength(1);
    core.writeAudit.mockReset();
    core.writeAudit.mockResolvedValue(undefined);
    await flushAudit();
    const retried = recorded();
    expect(retried).toHaveLength(1);
    expect(retried[0]?.action).toBe('session.unlock');
    await flushAudit();
    expect(recorded()).toHaveLength(1);
  });

  it('bounds the journal and keeps the newest events', async () => {
    core.writeAudit.mockRejectedValue(new core.AdminDbError('08006'));
    for (let index = 0; index < 25; index += 1) await recordAudit(event());
    core.writeAudit.mockReset();
    core.writeAudit.mockResolvedValue(undefined);
    await flushAudit();
    const retried = recorded();
    expect(retried).toHaveLength(20);
    expect(new Set(retried.map(item => item.eventId)).size).toBe(20);
  });

  it('does not retry a non-database refusal', async () => {
    core.writeAudit.mockRejectedValue(new Error('Admin configuration requires: SUPABASE_DB_URL.'));
    await expect(recordAudit(event())).resolves.toBeUndefined();
    core.writeAudit.mockReset();
    core.writeAudit.mockResolvedValue(undefined);
    await flushAudit();
    expect(recorded()).toHaveLength(0);
  });
});
