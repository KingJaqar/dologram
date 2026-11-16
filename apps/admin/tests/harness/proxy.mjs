// Test-only transport: leave the owner's port 3100 service untouched while preserving
// the exact production URL, Host, Origin and cookie behavior. No arbitrary forwarding.
import { createServer, request } from 'node:http';
import { connect } from 'node:net';

const sockets = new Set();
const server = createServer((incoming, outgoing) => {
  if (incoming.url === '/health') { outgoing.end('admin-isolated-transport'); return; }
  const url = new URL(incoming.url ?? '/', 'http://127.0.0.1:3100');
  if (url.origin !== 'http://127.0.0.1:3100') { outgoing.writeHead(403).end(); return; }
  const upstream = request({ hostname: '127.0.0.1', port: 3115, method: incoming.method,
    path: `${url.pathname}${url.search}`, headers: incoming.headers, timeout: 10000 }, response => {
    outgoing.writeHead(response.statusCode ?? 502, { ...response.headers, 'x-admin-test-transport': 'isolated-3115' });
    response.pipe(outgoing);
  });
  upstream.on('timeout', () => upstream.destroy());
  upstream.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
  incoming.pipe(upstream);
});
server.on('connect', (incoming, client, head) => {
  if (incoming.url !== '127.0.0.1:3100') { client.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
  const upstream = connect(3115, '127.0.0.1', () => {
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head.length) upstream.write(head);
    client.pipe(upstream); upstream.pipe(client);
  });
  sockets.add(upstream);
  upstream.on('close', () => sockets.delete(upstream));
  upstream.on('error', () => client.destroy());
  client.on('error', () => upstream.destroy());
  client.on('close', () => upstream.destroy());
  upstream.setTimeout(15000, () => upstream.destroy());
});
server.on('connection', socket => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});
server.listen(3114, '127.0.0.1', () => console.info(JSON.stringify({ fixture: 'admin-test-transport', pid: process.pid, port: 3114 })));
function close() {
  for (const socket of sockets) socket.destroy();
  server.close();
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
