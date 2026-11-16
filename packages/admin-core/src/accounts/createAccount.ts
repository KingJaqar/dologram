import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Sql } from 'postgres';
import { z } from 'zod';
import { validateDisplayName, validateEmail, validateUsername } from '@dologram/shared/src/validation/account';
import { dgTrim } from '@dologram/shared/src/validation/text';
import type { AuditEvent } from '../audit/write.ts';
import { asAdminDbError, getSql } from '../db.ts';
import { consumePasswordDraft, generatePassword } from '../passwords.ts';
import { getAdminClient } from '../supabase.ts';
import { getCreationCapability, type AccountCapability } from './modes.ts';
import { auditCreation, creationInitialized, creationSessionHash, type CreationOperation } from './recoverCreation.ts';

export type CreateAccountField = 'email' | 'username' | 'displayName';

export type CreateAccountResult =
  | { ok: true; userId: string; password: string; auditRecorded: boolean; operationId: string }
  /**
   * `userId` is set only when Auth created the account but initialization did not
   * finish: the caller must reuse that account instead of creating it again.
   */
  | { ok: false; field?: CreateAccountField; message: string; userId?: string; operationId?: string; password?: string; rateLimited?: boolean };

/** The subset of `auth.admin` this module needs, so tests inject a typed stand-in. */
export interface AdminCreateUserRequest {
  email: string;
  password: string;
  email_confirm: true;
  role: 'authenticated';
  user_metadata: { username: string; display_name: string };
  app_metadata: { must_change_password: true; admin_creation: CreationOperation };
}

export interface AdminUserApi {
  createUser(request: AdminCreateUserRequest): Promise<{
    data: { user: { id: string } | null };
    error: { code?: string; status?: number } | null;
  }>;
}

export interface CreateAccountDeps {
  sql?: Sql;
  users?: AdminUserApi;
  capability?: AccountCapability;
  audit?: (event: AuditEvent) => Promise<void>;
}

/** Strict: a caller-chosen password or any role field is refused, never ignored. */
const inputSchema = z.strictObject({
  email: z.string().max(254),
  username: z.string().max(64),
  displayName: z.string().max(200),
  source: z.enum(['admin', 'script']),
  actorUserId: z.uuid().nullable(),
  sessionId: z.string().min(1).max(128).optional(),
  passwordDraftId: z.uuid().optional(),
});

const DRAFT_UNAVAILABLE = 'The generated password is no longer available. Generate a new password and try again.';
const ACCOUNT_FAILED = 'The account could not be created. Try again.';
const OUTCOME_UNKNOWN = 'Account creation could not be confirmed. Check the accounts list before trying again; the account may already exist.';
const PROFILE_MISSING = 'The account was created but its normal-user profile or Saved Messages could not be confirmed. Do not create it again; reuse the existing account once the backend is repaired.';

function fieldError(field: CreateAccountField, message: string): CreateAccountResult {
  return { ok: false, field, message };
}

function authFailure(error: { code?: string; status?: number } | null): CreateAccountResult {
  if (error?.status === 429) return { ok: false, rateLimited: true, message: 'Rate limited; retry later.' };
  if (error?.code === 'email_exists' || error?.code === 'user_already_exists') {
    return fieldError('email', 'An account with this email already exists.');
  }
  return { ok: false, message: error?.status && error.status >= 400 && error.status < 500 ? ACCOUNT_FAILED : OUTCOME_UNKNOWN };
}

/**
 * ADM-04 single account creation (D-47, D-78, D-89, D-105, D-106, D-116).
 *
 * Passwords are never accepted from a caller: the browser submits an opaque draft
 * id that a verified session already generated, and the CLI never receives one at
 * all. The draft is consumed before the external effect so it cannot be replayed.
 * Pre-checks are advisory; the Auth Admin API still owns uniqueness.
 *
 * Creation stays refused while the forced-password contract is unverified (AB-02):
 * input validation and the read-only duplicate pre-checks still run, so the owner
 * receives the real field errors before the prerequisite message.
 */
export async function createAccount(input: unknown, deps: CreateAccountDeps = {}): Promise<CreateAccountResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'The account details are not valid.' };
  const { source, actorUserId, sessionId, passwordDraftId } = parsed.data;
  const email = dgTrim(parsed.data.email).toLowerCase();
  const username = dgTrim(parsed.data.username).toLowerCase();
  const displayName = dgTrim(parsed.data.displayName);

  if (!validateEmail(email)) return fieldError('email', 'Enter a valid email address.');
  if (!validateUsername(username)) {
    return fieldError('username', 'Username must be 5 to 32 characters: a lowercase letter, then lowercase letters, digits or underscores.');
  }
  if (!validateDisplayName(displayName)) return fieldError('displayName', 'Display name must be 1 to 64 characters.');
  if (source === 'admin' && (!actorUserId || !sessionId)) {
    return { ok: false, message: 'The account details are not valid.' };
  }

  const sql = deps.sql ?? getSql();
  const capability = deps.capability ?? await getCreationCapability(sql);
  try {
    const takenUsername = await sql<{ taken: number }[]>`
      select 1 as taken from public.profiles
      where lower(username) = ${username}
      limit 1`;
    if (takenUsername.length > 0) return fieldError('username', 'This username is taken.');
    const takenEmail = await sql<{ taken: number }[]>`
      select 1 as taken from auth.users
      where lower(email) = ${email}
      limit 1`;
    if (takenEmail.length > 0) return fieldError('email', 'An account with this email already exists.');
  } catch (error) {
    throw asAdminDbError(error);
  }

  if (capability.mutations === 'disabled' || capability.passwordFlag !== 'trigger') {
    return { ok: false, message: capability.prerequisite ?? 'Account creation is unavailable until its backend contract is verified.' };
  }

  let password: string;
  if (source === 'admin') {
    if (!passwordDraftId || !sessionId) return { ok: false, message: DRAFT_UNAVAILABLE };
    const draft = consumePasswordDraft({ passwordDraftId, sessionId });
    if (!draft.ok) return { ok: false, message: DRAFT_UNAVAILABLE };
    password = draft.password;
  } else {
    // The CLI/CSV paths never accept an initial password from the caller.
    password = generatePassword();
  }

  const users = deps.users ?? getAdminClient().auth.admin;
  const operation: CreationOperation = {
    id: source === 'admin' && passwordDraftId ? passwordDraftId : randomUUID(), actorUserId, source, username,
    sessionHash: source === 'admin' && sessionId ? creationSessionHash(sessionId) : null,
  };
  const operationId = operation.id;
  let response: Awaited<ReturnType<AdminUserApi['createUser']>>;
  try {
    response = await users.createUser({
      email,
      password,
      email_confirm: true,
      role: 'authenticated',
      user_metadata: { username, display_name: displayName },
      app_metadata: { must_change_password: true, admin_creation: operation },
    });
  } catch {
    return { ok: false, operationId, password, message: OUTCOME_UNKNOWN };
  }
  if (response.error || !response.data.user) {
    const failure = authFailure(response.error);
    return response.error?.status && response.error.status >= 400 && response.error.status < 500
      ? failure : { ...failure, operationId, password };
  }
  const userId = response.data.user.id;

  try {
    // Migration 018 creates the profile and its Saved Messages chat from the metadata.
    if (!await creationInitialized(sql, userId)) return { ok: false, userId, operationId, password, message: PROFILE_MISSING };
  } catch {
    return { ok: false, userId, operationId, password, message: 'The account was created but its profile could not be verified. Check this account before trying again; do not create another account.' };
  }

  // A failed audit write must not destroy the one-time password; it is reported instead.
  const auditRecorded = await auditCreation(operation, userId, sql, deps.audit);
  return { ok: true, userId, password, auditRecorded, operationId };
}

