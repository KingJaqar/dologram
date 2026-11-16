import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";

// Unit tests execute the server page outside the Next.js RSC compiler.
// The real compiler barrier is verified separately with a negative production build.
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue({ userId: "fixture-actor" }) }));
vi.mock('../../server/guards', () => ({ requirePageSession: vi.fn().mockResolvedValue({ userId: "fixture-actor" }) }));

const names = ["SUPABASE_URL", "SUPABASE_PROJECT_REF", "SUPABASE_SECRET_KEY", "SUPABASE_DB_URL", "SUPABASE_ACCESS_TOKEN", "BACKUP_DIR"];
afterEach(() => vi.unstubAllEnvs());

describe("configuration bootstrap page", () => {
  it("renders missing configuration without backend access", async () => {
    for (const name of names) vi.stubEnv(name, undefined);
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("DoloGram Admin");
    expect(html).toContain("Missing configuration");
    for (const name of names) expect(html).toContain(name);
  });

  it("does not render configured secrets or invalid input values", async () => {
    for (const name of names) vi.stubEnv(name, undefined);
    vi.stubEnv("SUPABASE_SECRET_KEY", "synthetic-secret-sentinel");
    vi.stubEnv("SUPABASE_URL", "invalid-url-sentinel");
    const html = renderToStaticMarkup(await Home());
    expect(html).toContain("Invalid configuration");
    expect(html).toContain("SUPABASE_URL");
    expect(html).not.toContain("<code>SUPABASE_SECRET_KEY</code>");
    expect(html).not.toMatch(/synthetic-secret-sentinel|invalid-url-sentinel/);
  });
});

