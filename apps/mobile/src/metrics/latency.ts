import { config } from '@dologram/shared';

const starts = new Map<string, number>();
const samples: number[] = [];

function enabled(): boolean {
  return process.env.EXPO_PUBLIC_DG_LATENCY_LOG === '1';
}

export function markSendStarted(messageId: string, startedAt = Date.now()): void {
  if (!enabled() || messageId.length === 0) return;
  starts.set(messageId, startedAt);
  console.info(`[DG_LATENCY] send-start ${messageId} ${startedAt}`);
}

export function markMessageReceived(messageId: string, receivedAt = Date.now()): void {
  if (!enabled() || messageId.length === 0) return;
  const startedAt = starts.get(messageId);
  console.info(`[DG_LATENCY] receive ${messageId} ${receivedAt}`);
  if (startedAt === undefined) return;
  starts.delete(messageId);
  const elapsedMs = receivedAt - startedAt;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return;
  samples.push(elapsedMs);
  if (samples.length > config.latency.samples) samples.shift();
  console.info(`[DG_LATENCY] ${Math.round(elapsedMs)}ms`);
}

export function getLatencySamples(): readonly number[] {
  return [...samples];
}

export function getLatencySummary(): { count: number; p95Ms: number | null; budgetMs: number } {
  const ordered = [...samples].sort((a, b) => a - b);
  const index = ordered.length === 0 ? -1 : Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1);
  return {
    count: ordered.length,
    p95Ms: index < 0 ? null : ordered[index],
    budgetMs: config.latency.budgetMs,
  };
}

export function resetLatencyCapture(): void {
  starts.clear();
  samples.length = 0;
}
