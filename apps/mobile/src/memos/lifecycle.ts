/** Native-free session boundary shared by every auth entry/exit path. */
export type MemoScope = { accountId: string; generation: number; offline: boolean };
let generation = 0;
let scope: MemoScope | null = null;
const listeners = new Set<() => void>();
const flushers = new Set<() => Promise<void>>();
let drain: () => Promise<void> = async () => {};
export function memoScope(): MemoScope | null { return scope; }
export function memoGeneration(): number { return generation; }
export function subscribeMemoScope(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function isMemoScopeCurrent(value: MemoScope): boolean { return value.generation === scope?.generation && value.accountId === scope.accountId; }
export function setMemoScope(accountId: string | null, offline = false): void {
  if (scope?.accountId === accountId && scope?.offline === offline) return;
  scope = accountId ? { accountId, generation: ++generation, offline } : null;
  if (!accountId) generation++;
  listeners.forEach((listener) => listener());
}
export function registerMemoDrain(callback: () => Promise<void>): void { drain = callback; }
export function registerMemoFlush(callback: () => Promise<void>): () => void { flushers.add(callback); return () => { flushers.delete(callback); }; }
export async function closeMemoSession(): Promise<void> {
  // User-driven changes cannot discard a failed draft write silently.
  await Promise.all([...flushers].map((flush) => flush()));
  setMemoScope(null);
  await drain();
}
export async function withMemoSessionChange<T>(change: () => Promise<T>): Promise<T> {
  const previous = scope;
  await closeMemoSession();
  const closedGeneration = generation;
  try { return await change(); }
  catch (error) {
    // A failed cloud switch/sign-out can resume only its own still-current local identity.
    if (previous && scope === null && generation === closedGeneration) setMemoScope(previous.accountId, previous.offline);
    throw error;
  }
}
