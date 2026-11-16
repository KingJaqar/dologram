import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { writeAudit } from '../audit/write.ts';
import { mintPasswordDraft } from '../passwords.ts';
import { createAccount, type CreateAccountDeps } from './createAccount.ts';
import { recoverAccountCreation, creationSessionHash } from './recoverCreation.ts';
import { csvInputSchema, normalizeCsvRow, validateRows, type CsvRow } from './validateRows.ts';

export const CSV_IMPORT_TTL_MS = 30 * 60 * 1000;
const REFUSED = 'This import is unavailable or expired. Do not recreate accounts whose results were lost; check the accounts list and explicitly reset their passwords if needed.';
type Actor = { sessionId: string; userId: string };
type Failure = { ok: false; message: string; userId?: undefined; operationId?: undefined; field?: undefined };
export type ImportRowResult = { row: number; email: string; password?: string; problem?: string; pending?: boolean; userId?: string };
type RowState = { value: CsvRow; problem?: string; operationId?: string; outcome?: ImportRowResult; created?: boolean };
type ImportState = {
  id: string; requestId: string; actorUserId: string; sessionHash: string; fingerprint: string; expiresAt: number;
  rows: RowState[]; busy: boolean; finished: boolean;
};
declare global { var __dgCsvImports: Map<string, ImportState> | undefined; }
function store() {
  const imports = globalThis.__dgCsvImports ??= new Map<string, ImportState>();
  for (const [id, state] of imports) if (!state.busy && state.expiresAt <= Date.now()) imports.delete(id);
  return imports;
}
function owned(id: unknown, actor: Actor): ImportState | undefined {
  if (!z.uuid().safeParse(id).success || typeof id !== 'string') return;
  const state = store().get(id);
  if (state && state.expiresAt > Date.now() && state.actorUserId === actor.userId && state.sessionHash === creationSessionHash(actor.sessionId)) return state;
}
const requestSchema = z.strictObject({ requestId: z.uuid(), input: csvInputSchema });

/** requestId makes a lost begin acknowledgement safe; it never chooses an Auth operation. */
export async function beginCsvImport(input: unknown, actor: Actor, deps: CreateAccountDeps = {}): Promise<Failure | { ok: true; importId: string }> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'The CSV request is invalid.' };
  const imports = store();
  const fingerprint = createHash('sha256').update(JSON.stringify(parsed.data.input)).digest('hex');
  const sessionHash = creationSessionHash(actor.sessionId);
  // A replay must preserve the original validated snapshot, even after accounts exist.
  const existing = [...imports.values()].find(state => state.requestId === parsed.data.requestId && state.sessionHash === sessionHash);
  if (existing) return existing.actorUserId === actor.userId && existing.sessionHash === sessionHash && existing.fingerprint === fingerprint
    ? { ok: true, importId: existing.id } : { ok: false, message: REFUSED };
  if (imports.size >= 32) return { ok: false, message: 'Too many imports are active. Try again later.' };
  const validation = await validateRows(parsed.data.input, deps.sql);
  if (!validation.ok) return validation;
  if (!validation.rows.some(row => !row.problem)) return { ok: false, message: 'The CSV has no valid account rows.' };
  // Recheck after asynchronous validation to avoid replacing another begin request.
  if ([...imports.values()].some(state => state.requestId === parsed.data.requestId && state.sessionHash === sessionHash)) return beginCsvImport(input, actor, deps);
  if (imports.size >= 32) return { ok: false, message: 'Too many imports are active. Try again later.' };
  const id = randomUUID();
  imports.set(id, {
    id, requestId: parsed.data.requestId, actorUserId: actor.userId, sessionHash, fingerprint,
    expiresAt: Date.now() + CSV_IMPORT_TTL_MS, busy: false, finished: false,
    rows: parsed.data.input.rows.map((value, index) => ({ value: normalizeCsvRow(value), problem: validation.rows[index]?.problem })),
  });
  return { ok: true, importId: id };
}

const rowSchema = z.strictObject({ importId: z.uuid(), row: z.number().int().min(1).max(100) });

/** Serial, immutable rows; replays reconcile the same Auth operation, never create again. */
export async function createCsvImportRow(input: unknown, actor: Actor, deps: CreateAccountDeps = {}): Promise<Failure | { ok: true; result: ImportRowResult }> {
  const parsed = rowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: REFUSED };
  const state = owned(parsed.data.importId, actor);
  const row = state?.rows[parsed.data.row - 1];
  if (!state || !row || row.problem || state.busy) return { ok: false, message: state?.busy ? 'Another import row is running.' : REFUSED };
  if (row.outcome && !row.outcome.pending) {
    return { ok: true, result: { ...row.outcome, ...(row.created ? { problem: 'The one-time password is no longer available. Use the password already shown, or explicitly reset it.' } : {}) } };
  }
  if (state.finished) return { ok: false, message: REFUSED };
  state.busy = true;
  const base = { row: parsed.data.row, email: row.value.email };
  try {
    if (row.operationId) {
      const recovered = await recoverAccountCreation({ operationId: row.operationId, actorUserId: actor.userId, sessionId: actor.sessionId, source: 'admin' }, deps);
      row.created = recovered.ok;
      row.outcome = recovered.ok
        ? { ...base, userId: recovered.userId, pending: !recovered.auditRecorded, problem: recovered.auditRecorded ? 'Recovered account. The one-time password was not retained; explicitly reset it if the original response was lost.' : 'Account exists; retry to recover its audit entry.' }
        : { ...base, userId: recovered.userId, pending: true, problem: recovered.message };
      return { ok: true, result: row.outcome };
    }
    let response: Awaited<ReturnType<typeof createAccount>>;
    // The SDK omits Retry-After; the contract permits one bounded 2s fallback.
    for (let attempt = 0; ; attempt += 1) {
      const draft = mintPasswordDraft({ sessionId: actor.sessionId });
      row.operationId = draft.passwordDraftId;
      response = await createAccount({ email: row.value.email, username: row.value.username, displayName: row.value.display_name,
        source: 'admin', actorUserId: actor.userId, sessionId: actor.sessionId, passwordDraftId: draft.passwordDraftId }, deps);
      if (response.ok || !response.rateLimited || attempt === 1) break;
      row.operationId = undefined; // Definitive 429: no Auth effect occurred.
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    row.created = response.ok;
    row.operationId = response.operationId;
    row.outcome = response.ok
      ? { ...base, userId: response.userId, ...(!response.auditRecorded ? { pending: true, problem: 'Account exists; retry to recover its audit entry.' } : {}) }
      : { ...base, userId: response.userId, problem: response.message, pending: Boolean(response.operationId) };
    // Return plaintext once; do not put it into the server-side import store.
    return { ok: true, result: { ...row.outcome, ...(response.password ? { password: response.password } : {}) } };
  } catch {
    row.outcome = { ...base, pending: Boolean(row.operationId), problem: 'The result could not be confirmed. Resume this import before trying a new file.' };
    return { ok: true, result: row.outcome };
  } finally { state.busy = false; }
}

export async function finishCsvImport(id: unknown, actor: Actor, deps: CreateAccountDeps = {}): Promise<Failure | { ok: true; created: number; invalid: number; total: number }> {
  const state = owned(id, actor);
  if (!state || state.busy) return { ok: false, message: REFUSED };
  if (state.rows.some(row => !row.problem && (!row.outcome || row.outcome.pending))) return { ok: false, message: 'Resume pending rows before finishing this import.' };
  const counts = { created: state.rows.filter(row => row.created).length, invalid: state.rows.filter(row => row.problem).length, total: state.rows.length };
  state.busy = true;
  try {
    await (deps.audit ?? (event => writeAudit(event, deps.sql)))({ eventId: state.id, actorUserId: actor.userId, action: 'account.import_csv',
      result: counts.created + counts.invalid === counts.total ? 'success' : 'failed', detail: counts });
    state.finished = true;
    return { ok: true, ...counts };
  } catch { return { ok: false, message: 'Accounts were processed, but the import audit could not be written. Retry finishing this import; do not create them again.' }; }
  finally { state.busy = false; }
}
