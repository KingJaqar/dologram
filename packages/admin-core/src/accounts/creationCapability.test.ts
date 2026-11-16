import { describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { getAccountCapability, getCreationCapability } from './modes.ts';

function database(installed: boolean, version: number, fail = false): Sql {
  return ((parts: TemplateStringsArray) => {
    if (fail) return Promise.reject(new Error('sensitive-provider-detail'));
    return Promise.resolve(parts.join('').includes('to_regprocedure') ? [{ installed }] : [{ version }]);
  }) as unknown as Sql;
}

describe('creation-only backend capability', () => {
  it('fails closed for an absent, incomplete, unknown or unavailable contract', async () => {
    for (const sql of [database(false, 43), database(true, 0), database(true, 44), database(true, 43, true)]) {
      expect(await getCreationCapability(sql)).toEqual(getAccountCapability());
    }
  });
  it('enables only the explicit creation consumer on a verified target', async () => {
    expect(await getCreationCapability(database(true, 43))).toEqual({ passwordFlag: 'trigger', banFallback: 'none', mutations: 'enabled', prerequisite: undefined });
    expect(getAccountCapability().mutations).toBe('disabled');
  });
});
