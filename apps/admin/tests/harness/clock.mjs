// Preloaded only by the isolated acceptance command, outside application discovery.
import { readFileSync } from 'node:fs';
import { createAccountAuth } from '../../../../packages/admin-core/src/auth/account.ts';
import { getSql } from '../../../../packages/admin-core/src/db.ts';
import { getAdminClient } from '../../../../packages/admin-core/src/supabase.ts';
import { createSessionStore } from '../../src/server/sessionStore.ts';
import { evidence, source, options } from './fixture.mts';
for (const [key, value] of Object.entries(source)) {
  if (process.env[key] !== value && key !== 'SUPABASE_SECRET_KEY') throw Error('Non-isolated test configuration refused');
}
globalThis.__dgAccountAuth = createAccountAuth(source, options);
// Reuse the application's own client construction with the confirmed isolated target.
globalThis.__dgAdminSql = { url: source.SUPABASE_DB_URL, sql: getSql(source, options) };
getAdminClient(source, options);
globalThis.__dgAdminAccountsV1 = createSessionStore(() => {
  const { offset } = JSON.parse(readFileSync(new URL('state.json', evidence), 'utf8'));
  if (!Number.isSafeInteger(offset) || offset < 0) throw Error('Invalid test clock');
  return Date.now() + offset;
});
console.info(JSON.stringify({ fixture: 'admin-account-disposable', pid: process.pid, port: 3115, auth: '127.0.0.1:3121', database: '127.0.0.1:3122', dataApi: '127.0.0.1:3123' }));


