import 'server-only';
import { createHash } from 'node:crypto';
import type { Sql } from 'postgres';
import { z } from 'zod';
import { writeAudit, type AuditEvent } from '../audit/write.ts';
import { getSql } from '../db.ts';
import { getCreationCapability, type AccountCapability } from './modes.ts';

const operationSchema = z.strictObject({
  id: z.uuid(),
  actorUserId: z.uuid().nullable(),
  sessionHash: z.string().length(64).nullable(),
  source: z.enum(['admin', 'script']),
  username: z.string().regex(/^[a-z][a-z0-9_]{4,31}$/u),
});

export type CreationOperation = z.infer<typeof operationSchema>;
export type RecoverCreationResult =
  | { ok: true; userId: string; auditRecorded: boolean }
  | { ok: false; message: string; userId?: string };

export interface RecoveryDeps {
  sql?: Sql;
  capability?: AccountCapability;
  audit?: (event: AuditEvent) => Promise<void>;
}

export function creationSessionHash(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex');
}

/** Shared by initial creation and recovery. No password enters the journal. */
export async function auditCreation(operation: CreationOperation, userId: string, sql: Sql,
  audit: RecoveryDeps['audit']): Promise<boolean> {
  try {
    await (audit ?? (event => writeAudit(event, sql)))({
      eventId: operation.id,
      actorUserId: operation.actorUserId,
      targetUserId: userId,
      action: 'account.create', result: 'success',
      detail: { username: operation.username, source: operation.source },
    });
    return true;
  } catch { return false; }
}

const inputSchema = z.strictObject({
  operationId: z.uuid(), actorUserId: z.uuid().nullable(),
  source: z.enum(['admin', 'script']), sessionId: z.string().min(1).max(128).optional(),
});
const UNKNOWN = 'Account creation could not be confirmed. Retry recovery later; do not create another account or generate another password.';
const REFUSED = 'This account creation operation is unavailable for this session.';

export async function creationInitialized(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql<{ user_id: string }[]>`
    select p.user_id::text from public.profiles p
    where p.user_id = ${userId}::uuid and p.roles = 'user'
      and exists (
        select 1 from public.chats c join public.chat_members cm on cm.chat_id = c.chat_id
        where c.type = 'direct' and c.direct_key = p.user_id::text
          and cm.user_id = p.user_id and cm.role = 'owner'
      )`;
  return rows.length === 1;
}

/**
 * Reconcile the server-minted marker stored atomically with Auth creation. This
 * path never calls createUser or changes a password. Browser recovery requires
 * both the original actor and session; scripts recover only script operations.
 * A restart loses password previews, but cannot cause recovery to create again.
 */
export async function recoverAccountCreation(input: unknown, deps: RecoveryDeps = {}): Promise<RecoverCreationResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: REFUSED };
  const { operationId, actorUserId, source, sessionId } = parsed.data;
  if ((source === 'admin' && (!actorUserId || !sessionId)) || (source === 'script' && actorUserId !== null)) {
    return { ok: false, message: REFUSED };
  }
  const sql = deps.sql ?? getSql();
  const capability = deps.capability ?? await getCreationCapability(sql);
  if (capability.mutations !== 'enabled' || capability.passwordFlag !== 'trigger') {
    return { ok: false, message: capability.prerequisite ?? 'Account recovery is unavailable until its backend contract is verified.' };
  }
  let userId: string | undefined;
  try {
    const rows = await sql<{ id: string; operation: unknown }[]>`
      select id::text, raw_app_meta_data -> 'admin_creation' as operation
      from auth.users where raw_app_meta_data -> 'admin_creation' ->> 'id' = ${operationId}
        and deleted_at is null limit 2`;
    if (rows.length !== 1 || !rows[0]) return { ok: false, message: UNKNOWN };
    const operation = operationSchema.safeParse(rows[0].operation);
    const sessionHash = sessionId ? creationSessionHash(sessionId) : null;
    if (!operation.success || operation.data.id !== operationId || operation.data.source !== source
      || operation.data.actorUserId !== actorUserId || operation.data.sessionHash !== sessionHash) {
      return { ok: false, message: REFUSED };
    }
    userId = rows[0].id;
    // Only repair still-denied, unpromoted accounts. Updating the SAME metadata
    // invokes the verified 012/018 profile + Saved Messages trigger atomically;
    // it does not replace metadata, alter a password or change application roles.
    if (!await creationInitialized(sql, userId)) {
      await sql`
        update auth.users u set raw_user_meta_data = u.raw_user_meta_data
        where u.id = ${userId}::uuid
          and not private.account_access_allowed(u.id)
          and (u.banned_until is null or u.banned_until <= now())
          and not exists (select 1 from public.profiles p where p.user_id = u.id and p.roles <> 'user')`;
      if (!await creationInitialized(sql, userId)) {
        return { ok: false, userId, message: 'The existing account is not fully initialized. Retry recovery after the backend is repaired; do not create another account.' };
      }
    }
    return { ok: true, userId, auditRecorded: await auditCreation(operation.data, userId, sql, deps.audit) };
  } catch {
    return { ok: false, userId, message: UNKNOWN };
  }
}
