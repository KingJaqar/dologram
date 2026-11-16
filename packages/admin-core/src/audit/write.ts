import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Sql } from 'postgres';
import { z } from 'zod';
import { asAdminDbError, getSql } from '../db.ts';
import { parseAuditDetail, type AuditAction, type AuditDetailMap } from './actions.ts';

const identity = z.uuid();

/** One action name paired with exactly its own detail shape. */
export type AuditEvent = {
  [K in AuditAction]: {
    eventId?: string;
    /** Verified authenticated account UUID; null only before authentication succeeds. */
    actorUserId: string | null;
    targetUserId?: string | null;
    action: K;
    result: 'success' | 'failed';
    detail: AuditDetailMap[K];
  };
}[AuditAction];

/** A malformed event is refused before any statement runs. */
export class AuditEventError extends Error {
  constructor() {
    super('Audit event fields are invalid.');
    this.name = 'AuditEventError';
  }
}

function uuidOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (!identity.safeParse(value).success) throw new AuditEventError();
  return value;
}

/**
 * Inserts one audit row. Pass a transaction-scoped `sql` handle so a SQL effect and
 * its audit row commit together. `event_id` makes a retried write idempotent.
 */
export async function writeAudit(event: AuditEvent, sql: Sql = getSql()): Promise<void> {
  const eventId = event.eventId ?? randomUUID();
  if (!identity.safeParse(eventId).success) throw new AuditEventError();
  const actorUserId = uuidOrNull(event.actorUserId);
  const targetUserId = uuidOrNull(event.targetUserId);
  if (event.result !== 'success' && event.result !== 'failed') throw new AuditEventError();
  const detail = parseAuditDetail(event.action, event.detail);
  try {
    await sql`
      insert into private.admin_audit (event_id, actor_user_id, action, target_user_id, result, detail)
      values (
        ${eventId}::uuid,
        ${actorUserId}::uuid,
        ${event.action},
        ${targetUserId}::uuid,
        ${event.result},
        ${sql.json(detail)}::jsonb
      )
      on conflict (event_id) do nothing`;
  } catch (error) {
    throw asAdminDbError(error);
  }
}
