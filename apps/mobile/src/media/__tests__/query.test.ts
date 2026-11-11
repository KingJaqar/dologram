import type { SQLiteDatabase } from 'expo-sqlite';
import { loadMediaAttachment } from '../query';
import { loadChatSnapshot } from '../../chat/query';
import { getUnsentItems } from '../../queue/localQueue';
import type { QueueItem } from '@dologram/shared';

jest.mock('../../queue/localQueue', () => ({ getUnsentItems: jest.fn() }));
const media = { media_id: 'media', media_type: 'photo', storage_path: 'chat/media' };
const queued: QueueItem = {
  temp_id: 'message', chat_id: 'chat', status: 'sending', retry_count: 0, next_attempt_at: 0, row_may_exist: true, row_state: 'stored', last_error: null, created_at: 0,
  payload: { kind: 'text', chat_id: 'chat', sender_id: 'me', content: 'Caption', reply_to: null, attachment_count: 2, attachments: [
    { media_id: 'media', media_type: 'photo', mime: 'image/jpeg', size_bytes: 100, local_uri: 'file:///private-photo', compressed: false },
    { media_id: 'waiting', media_type: 'file', mime: 'application/pdf', size_bytes: 100, local_uri: 'file:///private-file', compressed: false },
  ] },
};
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getUnsentItems).mockResolvedValue([queued]); });

test('non-member cannot load cached media or even inspect pending files', async () => {
  const first = jest.fn().mockResolvedValue(null);
  const db = { getFirstAsync: first } as unknown as SQLiteDatabase;
  await expect(loadMediaAttachment(db, 'chat', 'media', 'outsider')).rejects.toThrow('no longer available');
  expect(first).toHaveBeenCalledTimes(1);
});
test('cached live media resolves its storage path', async () => {
  const db = { getFirstAsync: jest.fn().mockResolvedValueOnce({ user_id: 'me' }).mockResolvedValueOnce({ payload: JSON.stringify(media) }) } as unknown as SQLiteDatabase;
  await expect(loadMediaAttachment(db, 'chat', 'media', 'me')).resolves.toMatchObject({ mediaId: 'media', storagePath: 'chat/media' });
});

test('a media tombstone cannot fall back to a pending private copy', async () => {
  const db = { getFirstAsync: jest.fn().mockResolvedValueOnce({ user_id: 'me' })
    .mockResolvedValueOnce({ payload: JSON.stringify({ ...media, deleted_at: '2026-11-11' }) }) } as unknown as SQLiteDatabase;
  await expect(loadMediaAttachment(db, 'chat', 'media', 'me')).rejects.toThrow('no longer available');
  expect(getUnsentItems).not.toHaveBeenCalled();
});
test('a deleted message cannot expose a pending private copy', async () => {
  const db = { getFirstAsync: jest.fn().mockResolvedValueOnce({ user_id: 'me' }).mockResolvedValueOnce(null).mockResolvedValueOnce({ deleted_at: '2026-11-10' }) } as unknown as SQLiteDatabase;
  await expect(loadMediaAttachment(db, 'chat', 'waiting', 'me')).rejects.toThrow('no longer available');
});
test('server echo retains pending status and local previews while media is incomplete', async () => {
  const first = jest.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('cache_chats')) return { payload: JSON.stringify({ chat_id: 'chat', type: 'direct', direct_key: 'me', created_at: '2026-11-10' }) };
    return { count: 0 };
  });
  const all = jest.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('cache_chat_members')) return [{ user_id: 'me', payload: JSON.stringify({ chat_id: 'chat', user_id: 'me', last_read_seq: 0 }) }];
    if (sql.includes('cache_messages')) return [{ payload: JSON.stringify({ message_id: 'message', chat_id: 'chat', sender_id: 'me', content: 'Caption', attachment_count: 2, reply_to: null, created_at: '2026-11-10', edited_at: null, deleted_at: null, seq: 1 }) }];
    if (sql.includes('cache_message_media')) return [{ message_id: 'message', payload: JSON.stringify(media) }];
    return [];
  });
  const result = await loadChatSnapshot({ getFirstAsync: first, getAllAsync: all } as unknown as SQLiteDatabase, 'chat', 'me');
  expect(result.messages).toHaveLength(1);
  expect(result.messages[0]?.pending?.status).toBe('sending');
  expect(result.messages[0]?.attachments).toEqual([
    expect.objectContaining({ mediaId: 'media', storagePath: 'chat/media' }),
    expect.objectContaining({ mediaId: 'waiting', localUri: 'file:///private-file' }),
  ]);
});
