import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

function database() {
  return {
    getFirstAsync: jest.fn().mockResolvedValue({ user_version: 7 }),
    execAsync: jest.fn().mockResolvedValue(undefined),
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
