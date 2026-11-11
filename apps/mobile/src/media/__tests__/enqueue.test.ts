import { enqueueAttachmentMessage } from '../../queue/attachments';
import { getQueueCore, requestQueueDrain } from '../../queue/localQueue';

const mockFiles = new Set<string>();
let mockCopies = 0;
let mockFailCopy = false;
const mockCreate = jest.fn();
jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///private' },
  Directory: class { uri: string; constructor(...parts: (string | { uri: string })[]) { this.uri = parts.map((part) => typeof part === 'string' ? part : part.uri).join('/'); } create(options: { idempotent?: boolean }) { mockCreate(options); } },
  File: class {
    uri: string;
    parentDirectory = { create: mockCreate };
    constructor(...parts: (string | { uri: string })[]) { this.uri = parts.map((part) => typeof part === 'string' ? part : part.uri).join('/'); }
    get exists() { return mockFiles.has(this.uri); }
    copy(destination: { uri: string }) { mockCopies++; mockFiles.add(destination.uri); if (mockFailCopy) throw new Error('disk full'); }
    delete() { mockFiles.delete(this.uri); }
  },
}));
jest.mock('../../queue/localQueue', () => ({ getQueueCore: jest.fn(), requestQueueDrain: jest.fn() }));
jest.mock('../../queue/events', () => ({ notifyQueueChange: jest.fn() }));
jest.mock('../../lib/ids', () => ({ ids: { messageId: () => 'message', mediaId: jest.fn().mockReturnValueOnce('one').mockReturnValueOnce('two').mockReturnValue('other') } }));

const source = { uri: 'file:///picker/photo.jpg', mediaType: 'photo' as const, mime: 'image/jpeg', sizeBytes: 100 };
beforeEach(() => { mockFiles.clear(); mockCopies = 0; mockFailCopy = false; mockCreate.mockClear(); jest.mocked(requestQueueDrain).mockClear(); });
test('all selected files are privately copied before the single enqueue', async () => {
  const enqueue = jest.fn(async () => { expect(mockCopies).toBe(2); return { ok: true, item: {} }; });
  jest.mocked(getQueueCore).mockResolvedValue({ countUnsent: async () => 0, enqueue } as unknown as Awaited<ReturnType<typeof getQueueCore>>);
  expect((await enqueueAttachmentMessage({ chatId: 'chat', senderId: 'user', content: '', attachments: [source, source] })).ok).toBe(true);
  expect(mockCreate).toHaveBeenCalledWith({ intermediates: true, idempotent: true });
  expect(enqueue).toHaveBeenCalledTimes(1);
  expect(requestQueueDrain).toHaveBeenCalledTimes(1);
});
test('partial disk copy failure leaves the draft unqueued and removes its copy', async () => {
  const enqueue = jest.fn();
  jest.mocked(getQueueCore).mockResolvedValue({ countUnsent: async () => 0, enqueue } as unknown as Awaited<ReturnType<typeof getQueueCore>>);
  mockFailCopy = true;
  expect(await enqueueAttachmentMessage({ chatId: 'chat', senderId: 'user', content: '', attachments: [source] })).toEqual({ ok: false, reason: 'copyFailed' });
  expect(enqueue).not.toHaveBeenCalled();
  expect(mockFiles.size).toBe(0);
});
