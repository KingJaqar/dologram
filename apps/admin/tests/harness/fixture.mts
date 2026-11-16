import { createHmac } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
export const evidence = pathToFileURL(resolve('../../supabase/repomix/admin-phase-04-account-20261115/browser') + sep);
export const database = 'postgres://postgres:disposable-local-only@127.0.0.1:3122/postgres';
export const options = { isolatedTarget: { projectRef: 'admin-account-disposable', apiOrigin: 'http://127.0.0.1:3120', databaseHost: '127.0.0.1', databasePort: '3122' } };
function jwt(role: string) {
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, iss: 'supabase', exp: Math.floor(Date.now()/1000)+86400 })}`;
  return `${body}.${createHmac('sha256', 'disposable-admin-phase-four-jwt-secret-only').update(body).digest('base64url')}`;
}
export const serviceKey = jwt('service_role');
export const anonKey = jwt('anon');
export const source = { SUPABASE_URL: options.isolatedTarget.apiOrigin, SUPABASE_PROJECT_REF: options.isolatedTarget.projectRef,
  SUPABASE_SECRET_KEY: serviceKey, SUPABASE_DB_URL: database, SUPABASE_ACCESS_TOKEN: 'disposable-unused', BACKUP_DIR: 'G:/disposable-admin-backups' };

