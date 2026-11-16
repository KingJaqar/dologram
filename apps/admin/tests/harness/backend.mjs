// Test-only gateway. No controls/endpoints are compiled into the application.
import { createServer, request } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { evidence } from './fixture.mts';
mkdirSync(evidence, { recursive: true });
const server = createServer((incoming, outgoing) => {
  if (incoming.url === '/health') { outgoing.end('admin-disposable-auth-gateway'); return; }
  let offline = false;
  try { offline = JSON.parse(readFileSync(new URL('state.json', evidence), 'utf8')).offline === true; } catch { /* Default online before tests initialize state. */ }
  if (offline) { outgoing.writeHead(503).end(); return; }
  const auth = incoming.url?.startsWith('/auth/v1/');
  const rest = incoming.url?.startsWith('/rest/v1/');
  if (!auth && !rest) { outgoing.writeHead(404).end(); return; }
  const upstream = request({ hostname: '127.0.0.1', port: auth ? 3121 : 3123, method: incoming.method,
    path: incoming.url.slice(8), headers: incoming.headers, timeout: 10000 }, res => {
    outgoing.writeHead(res.statusCode ?? 502, res.headers); res.pipe(outgoing);
  });
  upstream.on('timeout', () => upstream.destroy());
  upstream.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
  incoming.pipe(upstream);
});
server.listen(3120, '127.0.0.1', () => console.info('Disposable Phase 4 gateway listening on loopback 3120'));
function close() { server.closeAllConnections(); server.close(); }
process.on('SIGINT', close); process.on('SIGTERM', close);



