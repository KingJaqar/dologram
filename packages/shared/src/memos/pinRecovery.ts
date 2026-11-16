export type MemoPinResetChallenge = Readonly<{ challengeId: string; accountId: string; deviceNonce: string; action: 'reset_memo_pin'; expiresAt: number; attempts: number; consumed: boolean }>;
export const MEMO_PIN_RESET_TTL_MS = 10 * 60 * 1000;
export const MEMO_PIN_RESET_MAX_ATTEMPTS = 5;
export function createMemoPinResetChallenge(challengeId: string, accountId: string, deviceNonce: string, now: number): MemoPinResetChallenge {
  if (!challengeId || !accountId || !deviceNonce) throw new Error('PIN reset challenge identity is incomplete.');
  return Object.freeze({ challengeId, accountId, deviceNonce, action: 'reset_memo_pin' as const, expiresAt: now + MEMO_PIN_RESET_TTL_MS, attempts: 0, consumed: false });
}
export function validateMemoPinResetChallenge(challenge: MemoPinResetChallenge, accountId: string, deviceNonce: string, now: number, attempts: number): void {
  if (challenge.action !== 'reset_memo_pin' || challenge.accountId !== accountId || challenge.deviceNonce !== deviceNonce || challenge.consumed || challenge.expiresAt <= now || attempts >= MEMO_PIN_RESET_MAX_ATTEMPTS) throw new Error('PIN reset code is invalid or expired.');
}
