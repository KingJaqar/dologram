import * as Crypto from 'expo-crypto';

export type MemoTextCapture = Readonly<{ operation_id: string; item_id: string; text: string; created_at: number }>;

/** Called once on a save action. Retain this entire envelope for retries. */
export function prepareMemoTextCapture(text: string): MemoTextCapture {
  return Object.freeze({ operation_id: Crypto.randomUUID(), item_id: Crypto.randomUUID(), text, created_at: Date.now() });
}
