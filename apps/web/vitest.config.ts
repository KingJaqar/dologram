import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,mjs}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: false,
    maxWorkers: 1,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
