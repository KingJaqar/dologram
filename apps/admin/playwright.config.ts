import { defineConfig } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evidence, source, anonKey } from './tests/harness/fixture.mts';
delete process.env.NO_COLOR;
// Pinned Playwright 1.65.1 otherwise attaches the failed page's DOM, which can
// contain a generated-password preview even with trace/screenshots/video off.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
mkdirSync(evidence, { recursive: true });
if (!process.env.ADMIN_ACCOUNT_WORKER) {
  writeFileSync(new URL('state.json', evidence), JSON.stringify({ offset: 0, offline: false }));
  process.env.ADMIN_ACCOUNT_WORKER = '1';
}
export default defineConfig({
  testDir: './tests/e2e', timeout: 45000, expect: { timeout: 8000 }, fullyParallel: false, workers: 1, retries: 0,
  reporter: 'list', outputDir: resolve('../../supabase/repomix/admin-phase-04-account-20261115/browser/results'),
  use: { baseURL: 'http://127.0.0.1:3100', browserName: 'chromium', channel: 'chrome',
    proxy: { server: 'http://127.0.0.1:3114' }, trace: 'off', screenshot: 'off', video: 'off' },
  webServer: [
    { command: 'node tests/harness/backend.mjs', url: 'http://127.0.0.1:3120/health', reuseExistingServer: false, timeout: 15000, stdout: 'pipe', stderr: 'pipe' },
    { command: 'node --conditions=react-server --import tsx --import ./tests/harness/clock.mjs ../../node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3115', port: 3115,
      reuseExistingServer: false, timeout: 30000, stdout: 'pipe', stderr: 'pipe', env: source },
    { command: 'node tests/harness/proxy.mjs', url: 'http://127.0.0.1:3114/health', reuseExistingServer: false, timeout: 15000, stdout: 'pipe', stderr: 'pipe' },
    ...(process.env.ADMIN_PHASE8_WEB_DIR ? [{
      command: 'node ../../node_modules/next/dist/bin/next dev --webpack -H 127.0.0.1 -p 3116',
      cwd: process.env.ADMIN_PHASE8_WEB_DIR, url: 'http://127.0.0.1:3116/sign-in', reuseExistingServer: false,
      timeout: 90000, stdout: 'pipe' as const, stderr: 'pipe' as const,
      env: { NEXT_PUBLIC_SUPABASE_URL: 'https://phase8-backend.fixture.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1' },
    }] : []),
  ],
});


