import "server-only";
import { posix, win32 } from "node:path";
import { z } from "zod";

export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Explicit identity supplied only after an isolated target is confirmed by its caller. */
export interface ConfigOptions {
  isolatedTarget?: {
    projectRef: string;
    apiOrigin: string;
    databaseHost: string;
    databasePort: string;
  };
}

const text = z.string().min(1).refine((value) => value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value));

function parseUrl(value: string): URL | undefined {
  try { return new URL(value); } catch { return undefined; }
}

const apiUrl = text.refine((value) => {
  const url = parseUrl(value);
  return url !== undefined && ["https:", "http:"].includes(url.protocol)
    && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
});

const databaseUrl = text.refine((value) => {
  const url = parseUrl(value);
  return url !== undefined && ["postgres:", "postgresql:"].includes(url.protocol)
    && Boolean(url.username && url.password) && url.pathname === "/postgres" && !url.hash
    && [...url.searchParams.keys()].every((name) => name === "sslmode")
    && url.searchParams.getAll("sslmode").every((mode) => ["disable", "require", "verify-ca", "verify-full"].includes(mode));
});

const backendSchema = z.object({
  SUPABASE_URL: apiUrl,
  SUPABASE_PROJECT_REF: text.regex(/^[a-z][a-z0-9_-]{0,62}$/u),
  SUPABASE_SECRET_KEY: text,
  SUPABASE_DB_URL: databaseUrl,
  SUPABASE_ACCESS_TOKEN: text,
  BACKUP_DIR: text.refine((value) =>
    (/^[a-z]:[\\/]/iu.test(value) && win32.isAbsolute(value))
    || (/^\\\\[^\\]+\\[^\\]+/u.test(value) && win32.isAbsolute(value))
    || (process.platform !== "win32" && posix.isAbsolute(value))),
});

export type AdminEnv = z.infer<typeof backendSchema>;
type BackendName = keyof AdminEnv;
type EnvName = BackendName;

export interface AdminConfigStatus {
  ready: boolean;
  missing: EnvName[];
  invalid: EnvName[];
}

const backendNames = Object.keys(backendSchema.shape) as BackendName[];
const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

function targetIssues(source: EnvSource, options: ConfigOptions): BackendName[] {
  const invalid = new Set<BackendName>();
  const api = source.SUPABASE_URL ? parseUrl(source.SUPABASE_URL) : undefined;
  const db = source.SUPABASE_DB_URL ? parseUrl(source.SUPABASE_DB_URL) : undefined;
  const ref = source.SUPABASE_PROJECT_REF;
  const isolated = options.isolatedTarget;

  if (isolated) {
    const expectedApi = parseUrl(isolated.apiOrigin);
    const confirmed = expectedApi !== undefined && loopbackHosts.has(expectedApi.hostname)
      && ["http:", "https:"].includes(expectedApi.protocol)
      && !expectedApi.username && !expectedApi.password && expectedApi.pathname === "/"
      && !expectedApi.search && !expectedApi.hash && loopbackHosts.has(isolated.databaseHost)
      && /^[1-9][0-9]{0,4}$/u.test(isolated.databasePort)
      && Number(isolated.databasePort) <= 65535;
    if (ref && (!confirmed || ref !== isolated.projectRef)) invalid.add("SUPABASE_PROJECT_REF");
    if (api && (!confirmed || api.origin !== expectedApi?.origin)) invalid.add("SUPABASE_URL");
    if (db && (!confirmed || db.hostname !== isolated.databaseHost
      || (db.port || "5432") !== isolated.databasePort)) invalid.add("SUPABASE_DB_URL");
    return [...invalid];
  }

  if (ref && !/^[a-z]{20}$/u.test(ref)) invalid.add("SUPABASE_PROJECT_REF");
  if (api && (api.protocol !== "https:" || api.port
    || !/^[a-z]{20}\.supabase\.co$/u.test(api.hostname)
    || (ref && api.hostname !== `${ref}.supabase.co`))) invalid.add("SUPABASE_URL");
  if (db) {
    const port = db.port || "5432";
    const direct = /^db\.[a-z]{20}\.supabase\.co$/u.test(db.hostname)
      && db.username === "postgres" && (!ref || db.hostname === `db.${ref}.supabase.co`);
    const pooler = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/u.test(db.hostname)
      && /^postgres\.[a-z]{20}$/u.test(db.username)
      && (!ref || db.username === `postgres.${ref}`);
    if ((!direct && !pooler) || !["5432", "6543"].includes(port)
      || [...db.searchParams.keys()].some((name) => name !== "sslmode")
      || db.searchParams.getAll("sslmode").some((mode) => !["require", "verify-ca", "verify-full"].includes(mode))) {
      invalid.add("SUPABASE_DB_URL");
    }
  }
  return [...invalid];
}

function configStatus(source: EnvSource, names: readonly EnvName[], options: ConfigOptions): AdminConfigStatus {
  const missing: EnvName[] = [];
  const invalid = new Set<EnvName>();
  for (const name of names) {
    const value = source[name];
    if (value === undefined || value.trim() === "") {
      missing.push(name);
    } else {
      const schema = backendSchema.shape[name];
      if (!schema.safeParse(value).success) invalid.add(name);
    }
  }
  if (names.includes("SUPABASE_URL")) {
    for (const name of targetIssues(source, options)) {
      if (!missing.includes(name)) invalid.add(name);
    }
  }
  return { ready: missing.length === 0 && invalid.size === 0, missing, invalid: [...invalid] };
}

function requireReady(status: AdminConfigStatus): void {
  if (!status.ready) {
    // Keep input values and Zod/provider diagnostics out of errors.
    throw new Error(`Admin configuration requires: ${[...status.missing, ...status.invalid].join(", ")}.`);
  }
}

export function getAdminEnv(source: EnvSource = process.env, options: ConfigOptions = {}): AdminEnv {
  requireReady(configStatus(source, backendNames, options));
  return backendSchema.parse(source);
}

export function getAdminConfigStatus(source: EnvSource = process.env, options: ConfigOptions = {}): AdminConfigStatus {
  return configStatus(source, backendNames, options);
}
