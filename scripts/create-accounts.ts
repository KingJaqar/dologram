/**
 * Creates up to 100 DoloGram accounts from a CSV through @dologram/admin-core
 * (D-81, D-102, D-105, D-106).
 *
 * From the repository root:
 *   npm run create-accounts -- --csv accounts.csv
 *
 * The file needs a header row `email,username,display_name` and one account per row.
 * Credentials come from apps/admin/.env.local; this file contains none. Each generated
 * password is printed once and is never written to a file or the audit log.
 */
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createAccount } from '@dologram/admin-core';
import { parseProvisioningCsv, ProvisioningInputError } from './provisioningCsv.ts';

const MAX_BYTES = 256 * 1024;
const USAGE = 'Usage: npm run create-accounts -- --csv <path>';

async function main(): Promise<void> {
  let path: string | undefined;
  try {
    path = parseArgs({ options: { csv: { type: 'string' } }, strict: true }).values.csv;
  } catch {
    console.error('Unknown argument.');
  }
  if (!path) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stderr.isTTY) {
    console.error('Use an interactive terminal without redirection or transcription to receive the one-time passwords.');
    process.exitCode = 1;
    return;
  }

  // Bound the read itself, including files that grow after opening.
  const file = await open(resolve(path), 'r');
  let text: string;
  try {
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > MAX_BYTES) throw new ProvisioningInputError('The CSV exceeds the 256 KiB file limit.');
    text = buffer.subarray(0, length).toString('utf8');
  } finally { await file.close(); }
  const rows = parseProvisioningCsv(text);
  let created = 0;
  let refused = 0;
  let auditMissing = 0;
  for (const row of rows) {
    const result = await createAccount({
      email: row.email,
      username: row.username,
      displayName: row.displayName,
      source: 'script',
      actorUserId: null,
    });
    if (!result.ok) {
      refused += 1;
      console.error(`Line ${row.line}: refused${result.field ? ` (${result.field})` : ''}: ${result.message}`);
      if (result.userId) console.error(`Existing account: ${result.userId}`);
      if (result.operationId) console.error(`Recovery operation: ${result.operationId}. Use npm run create-user -- --recover with this ID; do not reimport this row.`);
      if (result.password) {
        console.info(`  Generated password: ${result.password}`);
        console.info('  Keep this password transiently for recovery; deliver it only after the account is confirmed.');
      }
      continue;
    }
    created += 1;
    if (!result.auditRecorded) {
      auditMissing += 1;
      console.error(`Recovery operation: ${result.operationId}. Use npm run create-user -- --recover with this ID to retry the audit.`);
    }
    console.info(`Line ${row.line}: ${result.userId}`);
    console.info(`  Generated password: ${result.password}`);
  }
  console.info(`${created} created, ${refused} refused.`);
  if (auditMissing > 0) {
    console.error(`${auditMissing} account(s) were created without an audit entry. Reuse them; do not create them again.`);
  }
  if (refused > 0 || auditMissing > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof ProvisioningInputError ? error.message : 'The import failed. Check the CSV file and backend configuration.');
  process.exitCode = 1;
});
