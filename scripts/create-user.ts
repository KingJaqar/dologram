/**
 * Creates one DoloGram account through @dologram/admin-core (D-102, D-105, D-106).
 *
 * From the repository root:
 *   npm run create-user -- --email user@example.com --username user_name --display-name "User Name"
 *
 * The npm script loads apps/admin/.env.local and enables the react-server export
 * condition. The generated password is printed once in a terminal, never to a file,
 * the audit log or a diagnostic, and no caller-chosen password is accepted.
 */
import { parseArgs } from 'node:util';
import { createAccount, recoverAccountCreation } from '@dologram/admin-core';

const USAGE = 'Usage: npm run create-user -- --email <email> --username <username> --display-name "<display name>" OR --recover <operation UUID>';

function refuse(message: string): void {
  console.error(message);
  console.error(USAGE);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  let options: { email?: string; username?: string; 'display-name'?: string; recover?: string };
  try {
    const parsed = parseArgs({
      options: {
        email: { type: 'string' },
        username: { type: 'string' },
        'display-name': { type: 'string' },
        recover: { type: 'string' },
      },
      strict: true,
    });
    options = parsed.values;
  } catch {
    refuse('Unknown or incomplete argument.');
    return;
  }
  const { email, username } = options;
  const displayName = options['display-name'];
  if (options.recover && (email || username || displayName)) {
    refuse('Recovery cannot be combined with new account details.');
    return;
  }
  if (!options.recover && (!email || !username || !displayName)) {
    refuse('Email, username and display name are required.');
    return;
  }

  if (options.recover) {
    const result = await recoverAccountCreation({ operationId: options.recover, source: 'script', actorUserId: null });
    if (result.ok && result.auditRecorded) {
      console.info(`Account recovered: ${result.userId}`);
      console.info('The original password was not changed and cannot be redisplayed. Use the password already delivered.');
    } else {
      console.error(result.ok ? 'The existing account audit entry is still unavailable. Retry recovery later.' : result.message);
      if ('userId' in result && result.userId) console.error(`Existing account: ${result.userId}`);
      process.exitCode = 1;
    }
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stderr.isTTY) {
    refuse('Use an interactive terminal without redirection or transcription to receive the one-time password.');
    return;
  }

  const result = await createAccount({ email, username, displayName, source: 'script', actorUserId: null });
  if (!result.ok) {
    console.error(`Refused${result.field ? ` (${result.field})` : ''}: ${result.message}`);
    if (result.userId) console.error(`Existing account: ${result.userId}`);
    if (result.operationId) console.error(`Recovery operation: ${result.operationId}. Use --recover with this ID; do not create again.`);
    if (result.password) {
      console.info(`Generated password: ${result.password}`);
      console.info('Keep this password transiently for recovery. Do not deliver it until the account is confirmed. It cannot be redisplayed.');
    }
    process.exitCode = 1;
    return;
  }
  console.info(`Account created: ${result.userId}`);
  console.info(`Generated password: ${result.password}`);
  console.info('This password is shown once. Deliver it directly; it is not stored anywhere.');
  if (!result.auditRecorded) {
    console.error('Warning: the audit entry could not be written. Reuse this account; do not create it again.');
    console.error(`Recovery operation: ${result.operationId}. Use --recover with this ID to retry the audit.`);
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.error('The account could not be created. Check the backend configuration and try again.');
  process.exitCode = 1;
});
