'use server';
import { createAccount as createAccountInCore, createCsvImportRow, mintPasswordDraft, recoverAccountCreation as recoverInCore } from '@dologram/admin-core';
import { revalidatePath } from 'next/cache';
import { guardedAction } from '../../../../server/guards';
import { strings } from '../../../../strings';
import type { CreateAccountActionResult, GeneratePasswordResult, RecoverCreationActionResult } from './types';

function refreshAccounts(): boolean {
  try { revalidatePath('/accounts'); return false; }
  catch { return true; }
}

/**
 * Mints one server-side password draft bound to the verified local session. The
 * password reaches React state only; no password is accepted from the browser.
 */
export async function generatePassword(): Promise<GeneratePasswordResult> {
  return guardedAction('generatePassword', async actor => {
    if (!actor) return { ok: false, message: strings.common.refused };
    try {
      const draft = mintPasswordDraft({ sessionId: actor.sessionId });
      return { ok: true, password: draft.password, passwordDraftId: draft.passwordDraftId };
    } catch {
      return { ok: false, message: strings.createAccount.passwordUnavailable };
    }
  });
}

/**
 * ADM-04 create. The verified actor and local session are injected here so a forged
 * payload cannot choose another identity, session or source.
 */
export async function createAccount(input: unknown): Promise<CreateAccountActionResult | Awaited<ReturnType<typeof createCsvImportRow>>> {
  return guardedAction('createAccount', async actor => {
    if (!actor) return { ok: false, message: strings.common.refused };
    const details = typeof input === 'object' && input !== null ? input : {};
    try {
      if ('importId' in details) {
        const result = await createCsvImportRow(input, actor);
        if (result.ok && result.result.userId) refreshAccounts();
        return result;
      }
      const result = await createAccountInCore(
        { ...details, source: 'admin', actorUserId: actor.userId, sessionId: actor.sessionId },
      );
      if (result.ok) {
        // Cache failure must not discard the applied identity or one-time password.
        return { ...result, ...(refreshAccounts() ? { refreshFailed: true } : {}) };
      }
      return result.field
        ? { ok: false, field: result.field, message: result.message }
        : { ok: false, message: result.message, userId: result.userId, ...(result.operationId ? { operationId: result.operationId } : {}) };
    } catch {
      return { ok: false, message: strings.common.requestFailed };
    }
  });
}

/** Reconciliation has the same live role/session and Origin checks as creation. */
export async function recoverAccountCreation(operationId: string): Promise<RecoverCreationActionResult> {
  return guardedAction('recoverAccountCreation', async actor => {
    if (!actor) return { ok: false, message: strings.common.refused };
    try {
      const result = await recoverInCore({ operationId, actorUserId: actor.userId, sessionId: actor.sessionId, source: 'admin' });
      return result.ok ? { ...result, ...(refreshAccounts() ? { refreshFailed: true } : {}) } : result;
    } catch {
      return { ok: false, message: strings.common.requestFailed };
    }
  });
}
