import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

function database() {
  return {
    getFirstAsync: jest.fn().mockResolvedValue({ user_version: 8 }),
    execAsync: jest.fn().mockResolvedValue(undefined),
    withTransactionAsync: jest.fn(async (run: () => Promise<void>) => run()),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  };
}

function loadDatabaseModule(): typeof import('../db') {
  // Simulate a new JS module without resetting the mocked native connection cache.
  let module!: typeof import('../db');
  jest.isolateModules(() => { module = jest.requireActual<typeof import('../db')>('../db'); });
  return module;
}

beforeEach(() => jest.mocked(openDatabaseAsync).mockReset());

test('bypasses a poisoned native cached handle, including after a module reload', async () => {
  const failure = new Error('NativeDatabase.prepareAsync: java.lang.NullPointerException');
  const stale = database();
  stale.getFirstAsync.mockRejectedValue(failure);
  const connections: ReturnType<typeof database>[] = [];
  jest.mocked(openDatabaseAsync).mockImplementation(async (_name, options) => {
    const db = options?.useNewConnection ? database() : stale;
    connections.push(db);
    return db as unknown as SQLiteDatabase;
  });

  const first = await loadDatabaseModule().getLocalDatabase();
  const reloaded = await loadDatabaseModule().getLocalDatabase();
  expect(first).not.toBe(reloaded);
  expect(connections).toHaveLength(2);
  expect(stale.getFirstAsync).not.toHaveBeenCalled();
  for (const db of connections) {
    expect(db.getFirstAsync).toHaveBeenCalledWith('PRAGMA user_version');
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  }
});

test('concurrent queue, sync and screen callers wait for one initialized connection', async () => {
  const db = database();
  db.getFirstAsync.mockResolvedValue({ user_version: 10 });
  let finish!: () => void;
  db.execAsync.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  jest.mocked(openDatabaseAsync).mockResolvedValue(db as unknown as SQLiteDatabase);
  const { getLocalDatabase } = loadDatabaseModule();
  const requests = [getLocalDatabase(), getLocalDatabase(), getLocalDatabase()];
  expect(requests[0]).toBe(requests[1]);
  expect(requests[1]).toBe(requests[2]);
  await Promise.resolve();
  expect(db.getFirstAsync).not.toHaveBeenCalled();
  finish();
  expect(await Promise.all(requests)).toEqual([db, db, db]);
  expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  expect(db.closeAsync).not.toHaveBeenCalled();
});

test('preserves v8 pending reads while applying the v9 membership and confirmation columns', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dologram-seen-v9-'));
  const file = join(directory, 'restart.db');
  let sqlite: DatabaseSync | null = new DatabaseSync(file);
  sqlite.exec(`
    CREATE TABLE pending_read_states (
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      last_read_seq INTEGER NOT NULL,
      PRIMARY KEY (user_id, chat_id)
    );
    CREATE TABLE cache_chat_members (
      chat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      nickname TEXT,
      last_read_seq INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      PRIMARY KEY (chat_id, user_id)
    );
    INSERT INTO pending_read_states (user_id, chat_id, last_read_seq)
      VALUES ('account-a', 'chat-a', 10);
    CREATE TABLE sync_state(chat_id TEXT PRIMARY KEY, cursor INTEGER NOT NULL DEFAULT 0);
    INSERT INTO sync_state VALUES ('chat-a', 999);
    PRAGMA user_version = 8;
  `);

  jest.mocked(openDatabaseAsync).mockResolvedValue({
    execAsync: async (sql: string) => sqlite?.exec(sql),
    getFirstAsync: async (sql: string, params: SQLInputValue[] = []) =>
      sqlite?.prepare(sql).get(...params) ?? null,
    withTransactionAsync: async (run: () => Promise<void>) => { await run(); },
    closeAsync: async () => { sqlite?.close(); sqlite = null; },
  } as unknown as SQLiteDatabase);

  try {
    const { getLocalDatabase } = loadDatabaseModule();
    const migrated = await getLocalDatabase();
    await migrated.closeAsync();
    const reopened = new DatabaseSync(file);

    expect(reopened.prepare('PRAGMA user_version').get()).toEqual({ user_version: 10 });
    expect(reopened.prepare('SELECT * FROM sync_checkpoint_backup').all()).toEqual([{chat_id: 'chat-a', cursor: 999}]);
    expect(reopened.prepare(
      'SELECT user_id, chat_id, last_read_seq, membership_joined_at FROM pending_read_states',
    ).all()).toEqual([{
      user_id: 'account-a', chat_id: 'chat-a', last_read_seq: 10, membership_joined_at: null,
    }]);
    expect(reopened.prepare('PRAGMA table_info(cache_chat_members)').all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'confirmed_last_read_seq' }),
        expect.objectContaining({ name: 'confirmed_joined_at' }),
      ]),
    );
    reopened.close();
  } finally {
    sqlite?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('releases failed initialization and lets the next caller retry with a fresh connection', async () => {
  const failure = new Error('NativeDatabase.prepareAsync: java.lang.NullPointerException');
  const failed = database();
  failed.getFirstAsync.mockRejectedValue(failure);
  failed.closeAsync.mockRejectedValue(new Error('native handle already released'));
  const healthy = database();
  jest.mocked(openDatabaseAsync)
    .mockResolvedValueOnce(failed as unknown as SQLiteDatabase)
    .mockResolvedValueOnce(healthy as unknown as SQLiteDatabase);
  const { getLocalDatabase } = loadDatabaseModule();
  await expect(getLocalDatabase()).rejects.toBe(failure);
  expect(failed.closeAsync).toHaveBeenCalledTimes(1);
  await expect(getLocalDatabase()).resolves.toBe(healthy);
  expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
});

test('a rejected native open does not poison future calls', async () => {
  const healthy = database();
  const failure = new Error('cannot open database');
  jest.mocked(openDatabaseAsync)
    .mockRejectedValueOnce(failure)
    .mockResolvedValueOnce(healthy as unknown as SQLiteDatabase);
  const { getLocalDatabase } = loadDatabaseModule();
  await expect(getLocalDatabase()).rejects.toBe(failure);
  await expect(getLocalDatabase()).resolves.toBe(healthy);
});


test('rejects a newer local schema before any migration or cache writer opens', async () => {
  const db = database(); db.getFirstAsync.mockResolvedValue({ user_version: 11 });
  jest.mocked(openDatabaseAsync).mockResolvedValue(db as unknown as SQLiteDatabase);
  await expect(loadDatabaseModule().getLocalDatabase()).rejects.toThrow('newer local database');
  expect(db.closeAsync).toHaveBeenCalledTimes(1);
  expect(db.execAsync).toHaveBeenCalledTimes(1); // Connection settings only.
});
