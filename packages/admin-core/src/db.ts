import 'server-only';
import postgres, { type Sql } from 'postgres';
import { getAdminEnv, type ConfigOptions, type EnvSource } from './env.ts';
import { databaseTls } from './databaseTls.ts';

/** Fixed message only; the connection string, SQL and row values never appear. */
export class AdminDbError extends Error {
  readonly code: string | undefined;

  constructor(code?: string) {
    super(code ? `Database request failed (${code}).` : 'Database request failed.');
    this.name = 'AdminDbError';
    this.code = code;
  }
}

/** Maps a driver/provider failure to a bounded SQLSTATE-only error. */
export function asAdminDbError(error: unknown): AdminDbError {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return new AdminDbError(typeof code === 'string' && /^[0-9A-Z]{5}$/u.test(code) ? code : undefined);
}

declare global {
  var __dgAdminSql: { url: string; sql: Sql } | undefined;
}

/**
 * One bounded client per process and connection string. `prepare: false` supports
 * the Supavisor transaction pooler (AS-5); TLS stays certificate-verified for a
 * hosted target and is disabled only for a confirmed isolated loopback target.
 */
export function getSql(source: EnvSource = process.env, options: ConfigOptions = {}): Sql {
  const url = source.SUPABASE_DB_URL;
  const cached = globalThis.__dgAdminSql;
  // A client seeded from already-validated configuration is reused as-is; the
  // first real call still validates the environment before connecting.
  if (cached && url !== undefined && cached.url === url) return cached.sql;
  const env = getAdminEnv(source, options);
  if (cached) void cached.sql.end({ timeout: 1 }).catch(() => undefined);
  const sql = postgres(env.SUPABASE_DB_URL, {
    ssl: databaseTls(Boolean(options.isolatedTarget)),
    max: 2,
    prepare: false,
    idle_timeout: 30,
    connect_timeout: 5,
    queue_timeout: 5,
    query_timeout: 15,
    cancel_timeout: 1,
    connection: { statement_timeout: 15000 },
    onnotice: () => undefined,
  });
  globalThis.__dgAdminSql = { url: env.SUPABASE_DB_URL, sql };
  return sql;
}
