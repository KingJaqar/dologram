import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// The package reuses the workspace TypeScript validation sources, so a real Node
// process needs a TS loader; `--conditions` still decides the `server-only` branch.
const loader = ["--import", "tsx"];

describe("server-only package exports in real Node processes", () => {
  it.each(["@dologram/admin-core", "@dologram/admin-core/env"])("allows %s only with react-server enabled", (specifier) => {
    const code = `const core = await import(${JSON.stringify(specifier)}); if (core.getAdminConfigStatus({}).missing.length !== 6) process.exit(2);`;
    const allowed = spawnSync(process.execPath, ["--conditions=react-server", ...loader, "--input-type=module", "--eval", code], { encoding: "utf8", timeout: 15000 });
    expect(allowed.error).toBeUndefined();
    expect(allowed.stderr).toBe("");
    expect(allowed.status).toBe(0);
    const denied = spawnSync(process.execPath, [...loader, "--input-type=module", "--eval", code], { encoding: "utf8", timeout: 15000 });
    expect(denied.status).not.toBe(0);
    expect(denied.stderr).toContain("cannot be imported from a Client Component");
  });

  it("does not export raw source paths that bypass the package API", () => {
    const denied = spawnSync(process.execPath, ["--conditions=react-server", ...loader, "--input-type=module", "--eval", 'await import("@dologram/admin-core/src/env.ts")'], { encoding: "utf8", timeout: 15000 });
    expect(denied.status).not.toBe(0);
    expect(denied.stderr).toContain("ERR_PACKAGE_PATH_NOT_EXPORTED");
  });
});

