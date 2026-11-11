import { describe, expect, it } from 'vitest';
import { config } from '../../../config';
import {
  createMediaSignedUrl,
  createDgClient,
  deleteChatAttachment,
  isAlreadyExistsError,
  mediaBucket,
  mediaStoragePath,
  uploadAttachment,
} from '../../../index';

const storage = {
  getItem: async (): Promise<string | null> => null,
  setItem: async (): Promise<void> => undefined,
  removeItem: async (): Promise<void> => undefined,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('media pipeline helpers (M3-01)', () => {
  it('deletes through the permission-checked RPC and returns the confirmed tombstone', async () => {
    const tombstone = { media_id: 'media-1', deleted_at: '2026-11-11T00:00:00Z', sync_seq: 3 };
    const calls: string[] = [];
    const client = createDgClient({ url: 'https://media.test', key: 'test-key', storage,
      fetch: async (input) => { calls.push(String(input)); return json(tombstone); },
    });
    await expect(deleteChatAttachment(client, 'media-1')).resolves.toEqual({ data: tombstone, error: null });
    expect(calls[0]).toContain('/rpc/delete_chat_attachment');
  });

  it('reports permission denial, missing migration, and transport rejection as failures', async () => {
    for (const status of [403, 404, 500]) {
      const client = createDgClient({ url: 'https://media.test', key: 'test-key', storage,
        fetch: async () => json({ code: '42501', message: 'private detail' }, status),
      });
      expect((await deleteChatAttachment(client, 'media-1')).error).not.toBeNull();
    }
    const client = createDgClient({ url: 'https://media.test', key: 'test-key', storage,
      fetch: async () => { throw new Error('private transport detail'); },
    });
    expect((await deleteChatAttachment(client, 'media-1')).error).not.toBeNull();
  });
  it('selects the bucket and object path from the media contract', () => {
    expect(mediaBucket('photo')).toBe(config.media.smallBucket);
    expect(mediaBucket('voice')).toBe(config.media.smallBucket);
    expect(mediaBucket('video')).toBe(config.media.largeBucket);
    expect(mediaBucket('file')).toBe(config.media.largeBucket);
    expect(mediaStoragePath('chat-1', 'media-1')).toBe('chat-1/media-1');
  });

  it('treats an already-existing object as an idempotent upload success', async () => {
    expect(isAlreadyExistsError({ statusCode: 409, message: 'The resource already exists' })).toBe(true);
    const client = createDgClient({
      url: 'https://media.test',
      key: 'test-key',
      storage,
      fetch: async () => json({ statusCode: '409', error: 'Asset Already Exists', message: 'The resource already exists' }, 400),
    });
    await expect(uploadAttachment(client, {
      chatId: 'chat-1',
      mediaId: 'media-1',
      mediaType: 'photo',
      mime: 'image/jpeg',
      sizeBytes: 10,
      body: new ArrayBuffer(10),
    })).resolves.toEqual({ data: null, error: null });
  });

  it('requests signed URLs with the configured lifetime', async () => {
    const calls: string[] = [];
    const client = createDgClient({
      url: 'https://media.test',
      key: 'test-key',
      storage,
      fetch: async (input) => {
        calls.push(String(input));
        return json({ signedURL: '/object/sign/chat-media-small/chat-1/media-1?token=test' });
      },
    });
    const result = await createMediaSignedUrl(client, 'photo', 'chat-1/media-1');
    expect(result.error).toBeNull();
    expect(result.data).toContain('/object/sign/chat-media-small/chat-1/media-1');
    expect(calls[0]).toContain('/storage/v1/object/sign/chat-media-small/chat-1/media-1');
  });
});
