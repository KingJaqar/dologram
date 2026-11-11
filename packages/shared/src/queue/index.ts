/**
 * Local queue core (M2-02, M2-03, LS-1 to LS-3, LS-7 to LS-9, D-06, D-10, D-27, D-77, D-93).
 * Platform adapters (expo-sqlite on mobile) implement `LocalQueueStore` and live outside this
 * package, so the shared core stays free of React Native imports.
 */
export type {
  EnqueueResult,
  LocalQueueStore,
  QueueItem,
  QueuePayload,
  QueueStatus,
  QueueTiming,
  QueuedAttachment,
  TextQueuePayload,
} from './types';
export { backoffDelayMs, nextAttemptAt, rateLimitDelayMs } from './backoff';
export { createQueueCore } from './core';
export type {
  AttemptOutcome,
  DiscardOptions,
  DiscardResult,
  QueueCore,
  QueueCoreDeps,
  RetryResult,
} from './core';
export { createQueueRunner } from './runner';
export type { AttemptRecord, AttachmentDeliverFn, DeliveryResult, DeliverFn, DrainSummary, QueueRunner, QueueRunnerDeps } from './runner';
