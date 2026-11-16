import 'server-only';
import { randomUUID } from 'node:crypto';
import { AdminDbError, writeAudit, type AuditEvent } from '@dologram/admin-core';

const MAX_PENDING = 20;

declare global {
  var __dgAdminPendingAudit: AuditEvent[] | undefined;
}

function queue(): AuditEvent[] {
  return globalThis.__dgAdminPendingAudit ??= [];
}

function enqueue(event: AuditEvent): void {
  const pending = queue();
  if (pending.length >= MAX_PENDING) pending.shift();
  pending.push(event);
}

/** Reconciles journaled events by identity and stops at the first failure. */
export async function flushAudit(): Promise<void> {
  const pending = queue();
  while (pending.length > 0) {
    const event = pending[0];
    if (!event) return;
    try {
      await writeAudit(event);
    } catch {
      return;
    }
    pending.shift();
  }
}

/**
 * Best-effort audit write. An outage never blocks the action it records: the event
 * is journaled in bounded process-local state (no session identifiers or
 * credentials) and reconciled by its stable event identity on a later request.
 */
export async function recordAudit(event: AuditEvent): Promise<void> {
  const recorded: AuditEvent = event.eventId ? event : { ...event, eventId: randomUUID() };
  try {
    await writeAudit(recorded);
  } catch (error) {
    // Only a database outage is retryable; refused details are dropped, not looped.
    if (error instanceof AdminDbError) enqueue(recorded);
    return;
  }
  await flushAudit();
}
