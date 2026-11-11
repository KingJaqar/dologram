import { createQueueCore } from '../core';
import { createMemoryStore } from '../memoryStore';
import type { QueueTiming, TextQueuePayload } from '../types';

const timing: QueueTiming = {
  timerMs: 15_000,
  backoffBaseMs: 2_000,
  backoffFactor: 2,
  backoffCapMs: 60_000,
  jitter: 0.2,
  maxAttempts: 8,
  maxUnsent: 200,
};

const payload: TextQueuePayload = {
  kind: 'text',
  chat_id: 'chat',
  sender_id: 'user',
  content: '',
  reply_to: null,
  attachment_count: 1,
  attachments: [],
};

test('Wi-Fi deferral preserves row order and does not consume an attempt', async () => {
  let now = 1_700_000_000_000;
  const store = createMemoryStore();
  const core = createQueueCore({ store, timing, now: () => now, random: () => 0.5 });
  await core.enqueue({ messageId: 'message', payload });
  const [item] = await core.nextDueItems();
  if (!item) throw new Error('expected a due item');
  const sending = await core.beginAttempt(item);
  const stored = await core.markRowStored(sending);

  const result = await core.applyResult(stored, { kind: 'deferred' });

  expect(result).toEqual({ status: 'deferred', retryAfterSec: 15 });
  expect(await core.listUnsent()).toEqual([expect.objectContaining({
    status: 'queued',
    retry_count: 0,
    row_state: 'stored',
    last_error: 'waitingWifi',
    next_attempt_at: now + timing.timerMs,
  })]);
  now += timing.timerMs;
  expect(await core.nextDueItems()).toEqual([expect.objectContaining({ temp_id: 'message' })]);
});
