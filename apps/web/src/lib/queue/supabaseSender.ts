import { classifyError, insertMessage, softDeleteMessage, validateMessageText,
  type ClassifiedError, type DgClient, type DgResult, type MessageRow, type QueueItem } from '@dologram/shared';
import type { DeliveryResult } from '@dologram/shared/src/queue/runner';

export type QueueTransport = {
  deliver: (item: QueueItem, signal: AbortSignal, current: () => boolean) => Promise<DeliveryResult>;
  discard: (item: QueueItem, signal: AbortSignal, current: () => boolean) => Promise<DgResult<unknown>>;
};
const rejected: ClassifiedError = { kind: 'server', code: 'QUEUE_INVALID', status: 400, permanent: true };

/** Only verified row identity/content can turn a duplicate-key rejection into success. */
function matches(row: MessageRow, item: QueueItem) {
  return row.message_id === item.temp_id && row.sender_id === item.payload.sender_id &&
    row.chat_id === item.chat_id && row.content === item.payload.content && row.reply_to === item.payload.reply_to &&
    row.attachment_count === item.payload.attachment_count && row.deleted_at === null;
}
function failure(error: ClassifiedError): ClassifiedError {
  if (error.kind !== 'server') return error;
  const permanent = error.status !== null && error.status >= 400 && error.status < 500 &&
    ![401, 408, 429].includes(error.status);
  return permanent ? { ...error, permanent: true } : error;
}
export function createSupabaseSender({ client, cache, invalidSession, deliverAttachments }: {
  client: DgClient;
  cache: (row: MessageRow, current: () => boolean) => Promise<void>;
  invalidSession: () => void;
  deliverAttachments?: (item: QueueItem, signal: AbortSignal, current: () => boolean) => Promise<ClassifiedError | null>;
}): QueueTransport {
  function check(signal: AbortSignal, current: () => boolean) {
    signal.throwIfAborted();
    if (!current()) throw new Error('Delivery ownership changed.');
  }
  function report(error: ClassifiedError) {
    if (error.kind === 'server' && error.status === 401) invalidSession();
    return failure(error);
  }
  return {
    async deliver(item, inherited, current) {
      const signal = AbortSignal.any([inherited, AbortSignal.timeout(10_000)]);
      check(signal, current);
      const { payload } = item;
      if (payload.sender_id === '' || payload.chat_id !== item.chat_id ||
          payload.attachment_count !== payload.attachments.length || !validateMessageText(payload.content, payload.attachment_count).ok) {
        return { error: rejected, rowStored: false };
      }
      let row: MessageRow;
      if (item.row_state === 'stored') {
        const read = await client.from('messages').select('*').eq('message_id', item.temp_id).abortSignal(signal).retry(false).single();
        if (read.error) return { error: report(classifyError(read.error, read.status)), rowStored: true };
        row = read.data;
      } else {
        const inserted = await insertMessage(client, { message_id: item.temp_id, chat_id: item.chat_id,
          sender_id: payload.sender_id, content: payload.content, reply_to: payload.reply_to, attachment_count: payload.attachment_count }, signal, false);
        check(signal, current);
        if (inserted.error?.kind === 'delivered') {
          const read = await client.from('messages').select('*').eq('message_id', item.temp_id).abortSignal(signal).retry(false).single();
          if (read.error) return { error: report(classifyError(read.error, read.status)), rowStored: false };
          row = read.data;
        } else if (inserted.error) {
          return { error: report(inserted.error), rowStored: false };
        } else { row = inserted.data; }
      }
      check(signal, current);
      if (!matches(row, item)) return { error: rejected, rowStored: false };
      await cache(row, current);
      check(signal, current);
      // Phase 16 supplies uploads. Retain stored-row attachment work until that pipeline exists.
      if (payload.attachments.length > 0) return { error: deliverAttachments ? await deliverAttachments(item, signal, current) : { ...rejected, code: 'MEDIA_PENDING' }, rowStored: true };
      return { error: null, rowStored: true };
    },
    async discard(item, inherited, current) {
      const signal = AbortSignal.any([inherited, AbortSignal.timeout(10_000)]);
      check(signal, current);
      const result = await softDeleteMessage(client, item.temp_id, signal, false);
      check(signal, current);
      if (result.error) return { data: null, error: report(result.error) };
      if (result.data.message_id !== item.temp_id || result.data.sender_id !== item.payload.sender_id ||
          result.data.chat_id !== item.chat_id || result.data.deleted_at === null) return { data: null, error: rejected };
      await cache(result.data, current);
      return { data: result.data, error: null };
    },
  };
}
