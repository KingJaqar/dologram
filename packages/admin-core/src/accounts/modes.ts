import 'server-only';
import type { Sql } from 'postgres';
import { getSql } from '../db.ts';

/**
 * Legacy reset/ban capability stays closed. Creation has its own live probe for
 * migration 043's clearing trigger, restrictive policies and guarded RPCs. Merely
 * preparing that migration locally never enables an unpatched target. Account
 * status continues to use Auth metadata; no initial_passwords fallback is assumed.
 */
export type PasswordFlagMode = 'trigger' | 'initialPasswords' | 'unsupported';

/** Ban denial source beyond Auth `banned_until`; no fallback table exists in this schema. */
export type BanFallbackMode = 'disabled_users' | 'none';

export interface AccountCapability {
  passwordFlag: PasswordFlagMode;
  banFallback: BanFallbackMode;
  /** Create/reset/ban stay disabled while the forced-password or ban contract is unverified. */
  mutations: 'enabled' | 'disabled';
  /** Prerequisite text for admin surfaces; undefined when mutations are enabled. */
  prerequisite: string | undefined;
}

const verified: AccountCapability = Object.freeze({
  passwordFlag: 'unsupported',
  banFallback: 'none',
  mutations: 'disabled',
  prerequisite:
    'Account creation, password reset and ban stay disabled until the forced-password and ban contracts are verified (AB-02). Account status is read-only and uses Auth metadata.',
});

export function getAccountCapability(): AccountCapability {
  return verified;
}

export function getPasswordFlagMode(): PasswordFlagMode {
  return verified.passwordFlag;
}

/** Creation only: migrations prepared on disk never enable an unpatched target. */
export async function getCreationCapability(sql?: Sql): Promise<AccountCapability> {
  try {
    const database = sql ?? getSql();
    const installed = await database<{ installed: boolean }[]>`
      select to_regprocedure('private.admin_creation_contract_version()') is not null as installed`;
    if (installed[0]?.installed !== true) return verified;
    const contract = await database<{ version: number }[]>`select private.admin_creation_contract_version() as version`;
    if (contract[0]?.version !== 43) return verified;
    return { passwordFlag: 'trigger', banFallback: 'none', mutations: 'enabled', prerequisite: undefined };
  } catch { return verified; }
}
