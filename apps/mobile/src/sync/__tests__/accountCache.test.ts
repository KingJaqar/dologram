import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { buildChatList, type ChatMemberRow, type MessageRow } from '@dologram/shared';
import { flushPendingReadStates, markChatRead } from '../../chat/readState';
import { loadChatListRows } from '../../chatList/query';
import { loadChatInfoSource } from '../../chats/infoQuery';
import { getLocalDatabase } from '../../queue/db';
import { createSqliteCacheStore } from '../cacheStore';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const date = '2026-11-11T00:00:00Z';

function member(chatId: string, userId: string, seq = 0): ChatMemberRow {
  return { chat_id: chatId, user_id: userId, joined_at: date, role: 'member',
    archived: false, muted_until: null, last_read_seq: seq, nickname: null };
}

test('pruning and flushing as either account preserve the other account’s chats and read state', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async (sql: string) => sqlite.exec(sql),
    getFirstAsync: async (sql: string, params: SQLInputValue[] = []) => sqlite.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, params: SQLInputValue[] = []) => sqlite.prepare(sql).all(...params),
    runAsync: async (sql: string, params: SQLInputValue[]) => sqlite.prepare(sql).run(...params),
    withTransactionAsync: async (run: () => Promise<void>) => { await run(); },
    withExclusiveTransactionAsync: async (run: (txn: SQLiteDatabase) => Promise<void>) => {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        await run(adapter as unknown as SQLiteDatabase);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  jest.mocked(openDatabaseAsync).mockResolvedValue(adapter as unknown as SQLiteDatabase);

  try {
    const db = await getLocalDatabase();
    const accountA = createSqliteCacheStore(db, 'a');
    const accountB = createSqliteCacheStore(db, 'b');
    for (const chatId of ['a-private', 'b-private', 'shared', 'revoked']) {
      await accountA.upsertChat({ chat_id: chatId, type: 'group', title: chatId,
        avatar_url: null, created_at: date, created_by: 'a', direct_key: null, next_seq: 1 });
    }
    for (const row of [member('a-private', 'a'), member('b-private', 'b'),
      member('shared', 'a'), member('shared', 'b'), member('revoked', 'a'), member('revoked', 'b')]) {
      await accountA.upsertMember(row);
    }
    const delivered: MessageRow = {
      message_id: 'shared-message', chat_id: 'shared', sender_id: 'a', content: 'hello',
      attachment_count: 0, reply_to: null, seq: 5, sync_seq: 5, created_at: date,
      edited_at: null, deleted_at: null,
    };
    await accountA.upsertMessage(delivered);

    for (const chatId of await accountB.listChatIds()) {
      if (chatId !== 'b-private' && chatId !== 'shared') await accountB.deleteChat(chatId);
    }
    expect((await loadChatListRows(db, 'b')).map((row) => row.chat.chat_id).sort()).toEqual(['b-private', 'shared']);
    expect((await loadChatListRows(db, 'a')).map((row) => row.chat.chat_id).sort()).toEqual(['a-private', 'revoked', 'shared']);
    expect(await loadChatInfoSource(db, 'a-private', 'b')).toEqual({ chat: null, members: [], profiles: [] });

    const sendA = jest.fn(async (chatId: string, seq: number) => ({ data: member(chatId, 'a', seq), error: null }));
    const sendB = jest.fn(async (chatId: string, seq: number) => ({ data: member(chatId, 'b', seq), error: null }));
    const sendHint = async () => true;
    await markChatRead(db, 'shared', 'a', 5, false, sendA, sendHint);
    expect(buildChatList(await loadChatListRows(db, 'a'), { userId: 'a', now: new Date(date) })
      .find((item) => item.chatId === 'shared')?.ownStatus).toBe('sent');
    await markChatRead(db, 'shared', 'b', 5, false, sendB, sendHint);
    await flushPendingReadStates(db, 'b', sendB, sendHint);
    await flushPendingReadStates(db, 'a', sendA, sendHint);
    expect(buildChatList(await loadChatListRows(db, 'a'), { userId: 'a', now: new Date(date) })
      .find((item) => item.chatId === 'shared')?.ownStatus).toBe('seen');
    expect(sendB.mock.calls.map((call) => call.slice(0, 2))).toEqual([['shared', 5]]);
    expect(sendA.mock.calls.map((call) => call.slice(0, 2))).toEqual([['shared', 5]]);

    await markChatRead(db, 'shared', 'a', 10, false, sendA, sendHint);
    let releaseSend!: (value: { data: ChatMemberRow; error: null }) => void;
    const response = new Promise<{ data: ChatMemberRow; error: null }>((resolve) => { releaseSend = resolve; });
    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const racingSend = jest.fn(async () => {
      signalStarted();
      return response;
    });
    const hint = jest.fn(async () => true);
    const racingFlush = flushPendingReadStates(db, 'a', racingSend, hint);
    await started;
    await markChatRead(db, 'shared', 'a', 12, false, sendA, sendHint);
    releaseSend({ data: member('shared', 'a', 10), error: null });
    await racingFlush;

    expect(await db.getFirstAsync(
      'SELECT last_read_seq, membership_joined_at FROM pending_read_states WHERE user_id = ? AND chat_id = ?',
      ['a', 'shared'],
    )).toEqual({ last_read_seq: 12, membership_joined_at: date });
    expect(hint).toHaveBeenCalledWith('shared', 10);

    const clampedHint = jest.fn(async () => true);
    await flushPendingReadStates(
      db,
      'a',
      async () => ({ data: member('shared', 'a', 11), error: null }),
      clampedHint,
    );
    expect(clampedHint).toHaveBeenCalledWith('shared', 11);
    expect(await db.getFirstAsync(
      'SELECT last_read_seq FROM pending_read_states WHERE user_id = ? AND chat_id = ?',
      ['a', 'shared'],
    )).toBeNull();

    await markChatRead(db, 'shared', 'a', 13, false, sendA, sendHint);
    const refreshMembership = jest.fn(async () => undefined);
    await flushPendingReadStates(
      db,
      'a',
      async () => ({ data: null, error: { kind: 'server' as const, code: 'DG409', status: 409 } }),
      sendHint,
      { onMembershipChanged: refreshMembership },
    );
    expect(refreshMembership).toHaveBeenCalledWith('shared');
    expect(await db.getFirstAsync(
      'SELECT last_read_seq FROM pending_read_states WHERE user_id = ? AND chat_id = ?',
      ['a', 'shared'],
    )).toBeNull();

    await db.runAsync("INSERT INTO queue_items(temp_id,chat_id,payload,status,next_attempt_at,created_at) VALUES ('retained-draft','shared','{}','failed',0,0)", []);
    await accountA.setCursor('shared', 9000);
    const run = adapter.runAsync;
    const fault = jest.spyOn(adapter, 'runAsync').mockImplementation(async (sql, params) => {
      if (sql.startsWith('INSERT INTO sync_checkpoint_upgrade')) throw new Error('Injected checkpoint interruption');
      return run(sql, params);
    });
    await expect(accountA.upgradeCheckpoints()).rejects.toThrow('interruption');
    expect(await accountA.getCursor('shared')).toBe(9000);
    fault.mockRestore();
    await accountA.upgradeCheckpoints();
    expect(await accountA.getCursor('shared')).toBe(0);
    expect(await db.getFirstAsync("SELECT temp_id,status FROM queue_items WHERE temp_id = 'retained-draft'")).toEqual({temp_id: 'retained-draft', status: 'failed'});
    expect(await db.getFirstAsync('SELECT cursor FROM sync_checkpoint_backup WHERE chat_id = ?', ['shared'])).toEqual({ cursor: 9000 });
    await accountA.setCursor('shared', 5); await accountB.upgradeCheckpoints();
    expect(await accountA.getCursor('shared')).toBe(5);
    await accountA.upsertMessage({ ...delivered, sync_seq: 20, deleted_at: date, content: '' });
    await accountA.upsertMessage(delivered);
    expect(await db.getFirstAsync('SELECT sync_seq, deleted_at FROM cache_messages WHERE message_id = ?', ['shared-message'])).toEqual({ sync_seq: 20, deleted_at: date });
  } finally {
    sqlite.close();
  }
});
