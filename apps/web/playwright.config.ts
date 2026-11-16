import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig, devices } from '@playwright/test';

if (existsSync('.env.test.local')) loadEnvFile('.env.test.local');
// Playwright explicitly forces color in workers; avoid conflicting parent hints.
delete process.env.NO_COLOR;
if (Object.keys(process.env).some((name) => /^NEXT_PUBLIC_.*(?:TEST_USER|PASSWORD|SECRET|SERVICE_ROLE)/i.test(name))) {
  throw new Error('Test credentials must stay runner-only.');
}

const external = process.env.E2E_BASE_URL || undefined;
const baseURL = external || 'http://127.0.0.1:3000';
const target = new URL(baseURL);
if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
  throw new Error('E2E_BASE_URL must be an HTTP(S) origin without credentials.');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  globalTimeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: external ? undefined : {
    command: 'node scripts/e2e-server.mjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 90_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    stdout: 'pipe',
  },
});
