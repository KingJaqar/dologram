export const CALL_RECOVERY_DELAYS_MS = [1000, 3000, 5000] as const;

/** Returns a bounded retry delay. A null result means recovery has been exhausted. */
export function callRecoveryDelayMs(attempt: number): number | null {
  return CALL_RECOVERY_DELAYS_MS[attempt] ?? null;
}
