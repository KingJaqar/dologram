import { defineConfig, devices } from '@playwright/test';

delete process.env.NO_COLOR;
export default defineConfig({
  testDir: './e2e', testMatch: 'phase-05-store.spec.ts', forbidOnly: true,
  workers: 1, retries: 0, timeout: 30000, globalTimeout: 180000,
  reporter: 'list', use: { actionTimeout: 10000, navigationTimeout: 10000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
