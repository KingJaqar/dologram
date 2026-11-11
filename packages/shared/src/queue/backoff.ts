/**
 * Retry timing (D-27, D-77, LS-7).
 *
 * Backoff is exponential — base 2 s, factor 2, cap 60 s — with ±20 % jitter. `retry_count` is the
 * number of attempts already counted, so the first retry (retry_count 1) waits about the base.
 */
import type { QueueTiming } from './types';

/**
 * The delay before the next attempt after the `retryCount`-th counted attempt. The result always
 * lies inside `[base * (1 - jitter), base * (1 + jitter)]` unless the cap itself applies.
 */
export function backoffDelayMs(
  retryCount: number,
  timing: Pick<QueueTiming, 'backoffBaseMs' | 'backoffFactor' | 'backoffCapMs' | 'jitter'>,
  random: () => number,
): number {
  const exponent = Math.max(0, retryCount - 1);
  const uncapped = timing.backoffBaseMs * Math.pow(timing.backoffFactor, exponent);
  const capped = Math.min(uncapped, timing.backoffCapMs);
  const span = capped * timing.jitter;
  // random() is [0, 1); the offset is therefore [-span, +span).
  const offset = span * (random() * 2 - 1);
  return Math.max(0, Math.round(capped + offset));
}

/** Epoch milliseconds at which an item becomes due after a counted failure. */
export function nextAttemptAt(
  retryCount: number,
  timing: QueueTiming,
  now: number,
  random: () => number,
): number {
  return now + backoffDelayMs(retryCount, timing, random);
}

/**
 * D-77: a rate-limit rejection is not an attempt; the item waits exactly the seconds the server
 * returned, with a minimum of one second (LS-8, DG429).
 */
export function rateLimitDelayMs(retryAfterSec: number): number {
  return Math.max(1, Math.trunc(retryAfterSec)) * 1000;
}
