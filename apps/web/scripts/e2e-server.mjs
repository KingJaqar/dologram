import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { applicationEnvironment } from './e2e-environment.mjs';

// Runner credentials are never inherited by the application server.
const env = applicationEnvironment(process.env);
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1'], {
  env,
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => { process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
