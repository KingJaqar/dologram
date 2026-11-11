/** Evidence-only entry. Never imported by DoloGram routes or production bundles. */
import React from 'react';
import { registerRootComponent } from 'expo';
import { Text } from 'react-native';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { searchCachedMessages } from '../../../../../apps/mobile/src/search/query';

// No AuthProvider, queue worker, sync lifecycle, notifications or account storage.
// Block fixture application traffic while preserving local development tooling.
// Metro constructs its HMR socket even when Fast Refresh is disabled (hot=false).
function blocked(): never { throw new Error('PHASE00_NETWORK_DISABLED'); }
const NativeWebSocket = globalThis.WebSocket;
class FixtureWebSocket extends NativeWebSocket {
  constructor(...args: ConstructorParameters<typeof WebSocket>) {
    // Only Metro and Expo devtools on this fixture's loopback server may connect.
    // All remote sockets and local application endpoints remain blocked.
    // React Native also accepts http(s) URLs here and converts them to ws(s).
    if (!__DEV__ || !/^(?:wss?|https?):\/\/(?:127\.0\.0\.1|localhost):8084\/(?:hot|message|expo-dev-plugins\/broadcast)(?:\?.*)?$/.test(String(args[0]))) {
      blocked();
    }
    super(...args);
  }
}
globalThis.fetch = async () => { throw new Error('PHASE00_NETWORK_DISABLED'); };
Object.defineProperty(globalThis, 'XMLHttpRequest', { configurable: true, value: blocked });
Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: FixtureWebSocket });

registerRootComponent(function PhaseZeroFixture() {
  return <Text>Search Phase 0: isolated native query baseline. Results are captured by ADB.</Text>;
});

async function measure() {
  const db = await openDatabaseAsync(':memory:');
  try {
    const identity = await db.getAllAsync<{ name: string; file: string }>('PRAGMA database_list');
    if (identity.some((item) => item.file !== '')) throw new Error('FIXTURE_NOT_IN_MEMORY');
    let isolationProbe = false;
    try { await fetch('https://example.invalid/phase00-network-probe'); }
    catch (error) { isolationProbe = error instanceof Error && error.message === 'PHASE00_NETWORK_DISABLED'; }
    if (!isolationProbe) throw new Error('NETWORK_FENCE_FAILED');
    await db.execAsync(`
      CREATE TABLE cache_messages (message_id TEXT PRIMARY KEY, chat_id TEXT, sender_id TEXT,
        seq INTEGER, created_at TEXT, deleted_at TEXT, payload TEXT);
      CREATE TABLE cache_chat_members (chat_id TEXT, user_id TEXT, nickname TEXT);
      CREATE TABLE cache_profiles (user_id TEXT, display_name TEXT);
      CREATE TABLE cache_message_media (message_id TEXT, payload TEXT);
      INSERT INTO cache_chat_members VALUES ('search-p0-chat', 'search-p0-me', NULL);
      WITH RECURSIVE fixture(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM fixture WHERE n < 259)
      INSERT INTO cache_messages SELECT printf('p0-%03d', n), 'search-p0-chat', 'search-p0-me', n + 1,
        '2026-11-11T00:00:00Z', NULL,
        json_object('content', CASE WHEN n < 35 THEN 'Search Phase 0 needle' ELSE 'Synthetic unrelated' END)
        FROM fixture;
    `);
    const batches: { rows: number; milliseconds: number }[] = [];
    const queryDb = Object.create(db) as SQLiteDatabase;
    queryDb.getAllAsync = async <T,>(sql: string, ...parameters: unknown[]): Promise<T[]> => {
      const started = performance.now();
      if (parameters.length !== 1 || !Array.isArray(parameters[0])) throw new Error('UNEXPECTED_QUERY_BINDING');
      const params = parameters[0];
      if (!params.every((value: unknown) => typeof value === 'string' || typeof value === 'number')) {
        throw new Error('UNEXPECTED_QUERY_PARAMETER');
      }
      const rows = await db.getAllAsync<T>(sql, params);
      batches.push({ rows: rows.length, milliseconds: performance.now() - started });
      return rows;
    };
    const started = performance.now();
    const first = await searchCachedMessages(queryDb, 'search-p0-me', '["search-p0-chat"]', 'needle', null, new AbortController().signal);
    const firstPageMs = performance.now() - started;
    const second = await searchCachedMessages(queryDb, 'search-p0-me', '["search-p0-chat"]', 'needle', first.next, new AbortController().signal);
    const totalMs = performance.now() - started;
    if (first.matches.length !== 30 || second.matches.length !== 5 || second.next !== null) throw new Error('BASELINE_MATCH_COUNT');
    const cancelled = new AbortController();
    cancelled.abort();
    const callsBefore = batches.length;
    await searchCachedMessages(queryDb, 'search-p0-me', '["search-p0-chat"]', 'needle', null, cancelled.signal);
    if (batches.length !== callsBefore) throw new Error('CANCELLED_QUERY_READ');
    return { fixture: '260 synthetic rows / 35 older-than-latest-200 matches',
      nativeDatabase: identity, networkFenceVerified: isolationProbe, firstPageMs, totalMs,
      deliveredMatches: 35, batches, cancelledReadCount: batches.length - callsBefore };
  } finally {
    await db.closeAsync();
  }
}

void measure().then(
  (result) => console.info('DG_SEARCH_PHASE00_RESULT', JSON.stringify(result)),
  (error: unknown) => console.error('DG_SEARCH_PHASE00_FAILURE', error instanceof Error ? error.message : 'Unknown fixture failure'),
);
