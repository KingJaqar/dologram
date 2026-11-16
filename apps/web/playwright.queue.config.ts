import { defineConfig, devices } from '@playwright/test';

delete process.env.NO_COLOR;
export default defineConfig({
  testDir: './e2e', testMatch: 'phase-06-queue.spec.ts', forbidOnly: true,
  workers: 1, retries: 0, timeout: 30_000, globalTimeout: 180_000,
  reporter: 'list', use: { actionTimeout: 10_000, navigationTimeout: 10_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
