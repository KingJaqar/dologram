'use server';
import { validateRows, beginCsvImport as begin, finishCsvImport as finish } from '@dologram/admin-core';
import { guardedAction } from '../../../../server/guards';
import { strings } from '../../../../strings';

export async function validateCsv(input: unknown) {
  return guardedAction('validateCsv', async () => {
    try { return await validateRows(input); }
    catch { return { ok: false as const, message: strings.common.requestFailed }; }
  });
}
export async function beginCsvImport(input: unknown) {
  return guardedAction('beginCsvImport', async actor => {
    if (!actor) return { ok: false as const, message: strings.common.refused };
    try { return await begin(input, actor); }
    catch { return { ok: false as const, message: strings.common.requestFailed }; }
  });
}
export async function finishCsvImport(importId: string) {
  return guardedAction('finishCsvImport', async actor => {
    if (!actor) return { ok: false as const, message: strings.common.refused };
    try { return await finish(importId, actor); }
    catch { return { ok: false as const, message: strings.common.requestFailed }; }
  });
}
