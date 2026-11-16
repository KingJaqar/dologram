import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const source = readFileSync(new URL('./assetIntegrity.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', javascript)(createRequire(import.meta.url), loaded, loaded.exports);
const { verifyMemoAssetStream } = loaded.exports;

const stream = (...chunks) => new ReadableStream({ start(controller) { for (const text of chunks) controller.enqueue(new TextEncoder().encode(text)); controller.close(); } });
test('hashes actual original bytes across chunks', async () => {
  assert.equal(await verifyMemoAssetStream(stream('he', 'llo'), 5, 'md5:5d41402abc4b2a76b9719d911017c592'), 'md5:5d41402abc4b2a76b9719d911017c592');
  assert.match(await verifyMemoAssetStream(stream('hello'), 5, null), /^sha256:[a-f0-9]{64}$/);
});
test('rejects truncation, extra bytes, wrong digest and unsupported bounds', async () => {
  await assert.rejects(verifyMemoAssetStream(stream('hell'), 5, null), /CHECKSUM_MISMATCH/);
  await assert.rejects(verifyMemoAssetStream(stream('hello!'), 5, null), /CHECKSUM_MISMATCH/);
  await assert.rejects(verifyMemoAssetStream(stream('world'), 5, 'md5:5d41402abc4b2a76b9719d911017c592'), /CHECKSUM_MISMATCH/);
  await assert.rejects(verifyMemoAssetStream(stream(), 51 * 1024 * 1024, null), /QUOTA/);
});
