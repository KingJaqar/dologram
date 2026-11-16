import { describe, expect, it, vi } from "vitest";
import { getAdminConfigStatus, getAdminEnv } from "./env.ts";
import type { ConfigOptions, EnvSource } from "./env.ts";

// These parser units run outside RSC. exports.test.ts checks the real marker
// in separate Node processes, and acceptance includes a negative Next build.
vi.mock("server-only", () => ({}));

const ref = "abcdefghijklmnopqrst";
const backend = {
  SUPABASE_URL: `https://${ref}.supabase.co`,
  SUPABASE_PROJECT_REF: ref,
  SUPABASE_SECRET_KEY: "synthetic-secret-sentinel",
  SUPABASE_DB_URL: `postgresql://postgres:synthetic-db-password@db.${ref}.supabase.co:5432/postgres`,
  SUPABASE_ACCESS_TOKEN: "synthetic-access-sentinel",
  BACKUP_DIR: "G:\\protected-backups",
};
const complete = backend;

describe("lazy configuration", () => {
  it("reports all six missing names without throwing or contacting the backend", () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network"));
    try {
      const status = getAdminConfigStatus({});
      expect(status.ready).toBe(false);
      expect(status.missing).toHaveLength(6);
      expect(status.invalid).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });

  it("rechecks the supplied environment on each call", () => {
    const source: Record<string, string> = { ...complete };
    expect(getAdminConfigStatus(source).ready).toBe(true);
    delete source.SUPABASE_SECRET_KEY;
    expect(getAdminConfigStatus(source).missing).toEqual(["SUPABASE_SECRET_KEY"]);
  });

  it.each(["", " ", undefined])("treats an unset/blank secret as missing (%s)", (value) => {
    expect(getAdminConfigStatus({ ...complete, SUPABASE_SECRET_KEY: value }).missing).toEqual(["SUPABASE_SECRET_KEY"]);
  });

  it.each([
    ["BACKUP_DIR", "relative/backups"],
    ["BACKUP_DIR", "G:relative"],
    ["BACKUP_DIR", "\\rooted-without-drive"],
    ["SUPABASE_URL", `http://${ref}.supabase.co`],
    ["SUPABASE_URL", `https://user:password@${ref}.supabase.co`],
    ["SUPABASE_URL", `https://${ref}.supabase.co/rest/v1`],
    ["SUPABASE_URL", `https://${ref}.supabase.co?token=sentinel`],
    ["SUPABASE_URL", "https://otherabcdefghijklmnop.supabase.co"],
    ["SUPABASE_URL", `https://${ref}.supabase.co.evil.invalid`],
    ["SUPABASE_URL", "https://127.0.0.1"],
    ["SUPABASE_PROJECT_REF", "local-unconfirmed"],
    ["SUPABASE_DB_URL", "postgresql://postgres:sentinel@db.otherabcdefghijklmnop.supabase.co/postgres"],
    ["SUPABASE_DB_URL", `postgresql://postgres:sentinel@db.${ref}.supabase.co/other`],
    ["SUPABASE_DB_URL", `postgresql://postgres:sentinel@db.${ref}.supabase.co/postgres?sslmode=disable`],
    ["SUPABASE_DB_URL", `postgresql://postgres:sentinel@db.${ref}.supabase.co/postgres?host=evil.invalid`],
    ["SUPABASE_DB_URL", `postgresql://postgres:sentinel@db.${ref}.supabase.co/postgres?sslmode=unknown`],
    ["SUPABASE_DB_URL", "postgresql://postgres:sentinel@127.0.0.1:54322/postgres"],
    ["SUPABASE_DB_URL", `https://postgres:sentinel@db.${ref}.supabase.co/postgres`],
    ["SUPABASE_SECRET_KEY", " invalid-secret-sentinel"],
    ["SUPABASE_ACCESS_TOKEN", "token\nheader"],
  ])("reports invalid %s without returning its value", (name, value) => {
    const status = getAdminConfigStatus({ ...complete, [name]: value });
    expect(status.ready).toBe(false);
    expect(status.invalid).toContain(name);
    expect(JSON.stringify(status)).not.toContain(value);
  });

  it.each(["5432", "6543"])("accepts same-project shared pooler on port %s", (port) => {
    const env = { ...backend, SUPABASE_DB_URL: `postgresql://postgres.${ref}:sentinel@aws-0-ap-southeast-1.pooler.supabase.com:${port}/postgres` };
    expect(getAdminEnv(env)).toEqual(env);
    expect(getAdminConfigStatus({ ...env, SUPABASE_DB_URL: env.SUPABASE_DB_URL.replace(ref, "zyxwvutsrqponmlkjihg") }).invalid).toContain("SUPABASE_DB_URL");
  });

  it("accepts an absolute UNC backup directory", () => {
    expect(getAdminEnv({ ...backend, BACKUP_DIR: "\\\\server\\protected\\backups" }).BACKUP_DIR).toBe("\\\\server\\protected\\backups");
  });

  it("throws only variable names for invalid/missing backend settings", () => {
    const source: EnvSource = { ...complete, SUPABASE_SECRET_KEY: undefined };
    expect(() => getAdminEnv(source)).toThrow("SUPABASE_SECRET_KEY");
    try { getAdminEnv(source); } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toMatch(/sentinel|synthetic|postgresql|supabase\.co/);
    }
  });
});

describe("explicit isolated loopback identity", () => {
  const source = {
    ...complete,
    SUPABASE_PROJECT_REF: "admin-isolated-fixture",
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_DB_URL: "postgresql://postgres:synthetic@127.0.0.1:54322/postgres",
  };
  const options: ConfigOptions = {
    isolatedTarget: { projectRef: "admin-isolated-fixture", apiOrigin: "http://127.0.0.1:54321", databaseHost: "127.0.0.1", databasePort: "54322" },
  };

  it("requires caller confirmation and validates both endpoints against it", () => {
    expect(getAdminConfigStatus(source).ready).toBe(false);
    expect(getAdminConfigStatus(source, options).ready).toBe(true);
    expect(getAdminEnv(source, options).SUPABASE_PROJECT_REF).toBe(source.SUPABASE_PROJECT_REF);
    expect(getAdminConfigStatus({ ...source, SUPABASE_URL: "http://127.0.0.1:54320" }, options).invalid).toContain("SUPABASE_URL");
    expect(getAdminConfigStatus({ ...source, SUPABASE_DB_URL: source.SUPABASE_DB_URL.replace(":54322", ":54323") }, options).invalid).toContain("SUPABASE_DB_URL");
    expect(getAdminConfigStatus({ ...source, SUPABASE_PROJECT_REF: "other-fixture" }, options).invalid).toContain("SUPABASE_PROJECT_REF");
    expect(getAdminConfigStatus({ ...source, SUPABASE_DB_URL: `${source.SUPABASE_DB_URL}?host=remote.invalid` }, options).invalid).toContain("SUPABASE_DB_URL");
  });

  it("cannot use isolated confirmation to permit remote hosts", () => {
    const unsafe: ConfigOptions = { isolatedTarget: { projectRef: ref, apiOrigin: backend.SUPABASE_URL, databaseHost: `db.${ref}.supabase.co`, databasePort: "5432" } };
    expect(getAdminConfigStatus(complete, unsafe).invalid).toEqual(expect.arrayContaining(["SUPABASE_URL", "SUPABASE_PROJECT_REF", "SUPABASE_DB_URL"]));
  });
});

