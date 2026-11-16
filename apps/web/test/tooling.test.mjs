import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ESLint } from 'eslint';
import stylelint from 'stylelint';
import { expect, test } from 'vitest';
import { applicationEnvironment } from '../scripts/e2e-environment.mjs';

const root = resolve(import.meta.dirname, '../../..');

test('scanner rejects missing/empty inputs and secrets without disclosing values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dg-web-scan-'));
  const env = { ...process.env, TEST_USER_A_PASSWORD: 'fixture-sensitive-43b7' };
  const scan = (path) => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts/scan-web-bundle.ps1'), '-Path', path], { env, encoding: 'utf8', timeout: 10_000 });
  try {
    expect(scan(join(dir, 'missing')).status).toBe(1);
    expect(scan(dir).status).toBe(1);
    const next = join(dir, '.next');
    mkdirSync(next);
    expect(scan(next).status).toBe(1);
    mkdirSync(join(next, 'static'));
    mkdirSync(join(next, 'server'));
    writeFileSync(join(next, 'static', 'client.js'), 'DoloGram client');
    writeFileSync(join(next, 'server', 'server.js'), 'DoloGram server');
    expect(scan(next).status).toBe(0);
    const file = join(dir, 'bundle.js');
    writeFileSync(file, 'DoloGram sb_publishable_public_value');
    expect(scan(dir).status).toBe(0);
    const privileged = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from('{"role":"service_role"}').toString('base64url')}.signature`;
    for (const material of ['SUPABASE_SECRET_KEY', 'TEST_USER_A_EMAIL', 'sb_secret_fixture_value_123456789012345', env.TEST_USER_A_PASSWORD, privileged]) {
      writeFileSync(file, material);
      const result = scan(dir);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('bundle.js:');
      expect(result.stdout).not.toContain(material);
      expect(result.stderr).not.toContain(material);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 30_000);

test('ESLint enforces accessibility and color tokens; generated colors are excluded', async () => {
  const eslint = new ESLint({ cwd: resolve(import.meta.dirname, '..') });
  const [result] = await eslint.lintText('export default function Sample() { return <div><img src="/image.png" />{"#ffffff"}</div>; }', { filePath: 'src/components/lint-fixture.tsx' });
  expect(result.messages.some((message) => message.ruleId === 'jsx-a11y/alt-text')).toBe(true);
  expect(result.messages.some((message) => message.ruleId === 'no-restricted-syntax')).toBe(true);
  const [generated] = await eslint.lintText('export const color = "#ffffff";', { filePath: 'src/theme/generated/lint-fixture.ts' });
  expect(generated.messages.filter((message) => message.ruleId === 'no-restricted-syntax')).toEqual([]);
}, 30_000);

test('Stylelint rejects literal colors/fonts outside generated theme output', async () => {
  const lint = (code, filename) => stylelint.lint({ code, codeFilename: resolve(filename), configFile: resolve('stylelint.config.mjs') });
  expect((await lint('a { color: #ffffff; font-family: Arial; }', 'src/app/lint-fixture.css')).errored).toBe(true);
  expect((await lint('a { color: var(--text); font-family: var(--font-body); }', 'src/app/lint-fixture.css')).errored).toBe(false);
  expect((await lint(':root { --text: #ffffff; }', 'src/theme/generated/lint-fixture.css')).errored).toBe(false);
  expect((await lint('a { color: #ffffff; }', 'src/components/Icon/negative-control.module.css')).errored).toBe(true);
});

test('screens cannot import Lucide directly while the typed icon adapter can', async () => {
  const eslint = new ESLint({ cwd: resolve(import.meta.dirname, '..') });
  const code = 'import { Check } from "lucide-react"; export default Check;';
  const [screen] = await eslint.lintText(code, { filePath: 'src/app/import-control.tsx' });
  const [adapter] = await eslint.lintText(code, { filePath: 'src/components/Icon/import-control.tsx' });
  expect(screen.messages.some((message) => message.ruleId === 'no-restricted-imports')).toBe(true);
  expect(adapter.messages.some((message) => message.ruleId === 'no-restricted-imports')).toBe(false);
}, 30_000);

test('unit and browser runners fail when a requested suite has zero tests', () => {
  const run = (bin, args) => spawnSync(process.execPath, [resolve(root, 'node_modules', bin), ...args], { cwd: resolve('..', 'web'), encoding: 'utf8', timeout: 20_000 });
  const unit = run('vitest/vitest.mjs', ['run', 'phase-00-deliberately-missing']);
  expect(unit.status).toBe(1);
  expect(unit.stdout + unit.stderr).toMatch(/No test files found/);
  const browser = run('@playwright/test/cli.js', ['test', 'phase-00-deliberately-missing', '--list']);
  expect(browser.status).toBe(1);
  expect(browser.stdout + browser.stderr).toMatch(/No tests found/);
}, 45_000);

test('test env loading is runner-only and the server strips runner secrets', () => {
  const env = applicationEnvironment({ TEST_USER_A_EMAIL: 'fixture@example.test', TEST_USER_A_PASSWORD: 'fixture', E2E_ALLOW_MUTATIONS: 'isolated', SUPABASE_SECRET_KEY: 'fixture', NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.example', PATH: 'retained', NODE_ENV: 'test' });
  expect(env).toEqual({ NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.example', PATH: 'retained', NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1' });
  // Exercise native env-file support in a separate process, without importing it in app code.
  const dir = mkdtempSync(join(tmpdir(), 'dg-web-env-'));
  try {
    writeFileSync(join(dir, '.env.test.local'), 'TEST_USER_A_EMAIL=runner-only\n');
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', 'const {default:c}=await import(process.argv[1]); process.exit(c.webServer === undefined && process.env.TEST_USER_A_EMAIL === "runner-only" ? 0 : 1)', pathToFileURL(resolve('playwright.config.ts')).href], { cwd: dir, env: { ...process.env, E2E_BASE_URL: 'https://fixture.example' }, timeout: 10_000 });
    expect(result.status).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
