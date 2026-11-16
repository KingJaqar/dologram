import { conversationIdentity, type MemoPreference } from '@dologram/shared';
import { activeMemoScope, withMemoStore } from './vault';

export async function memoPreference(key: string, preference: MemoPreference, enabled: boolean): Promise<void> {
  const identity = conversationIdentity(key);
  if (identity.kind !== 'memo') throw new Error('Expected a memo conversation');
  await withMemoStore(activeMemoScope(), (store) => store.preference(identity.memoId, preference, enabled), true);
}
export async function memoMute(key: string, until: string | null): Promise<void> {
  const identity = conversationIdentity(key);
  if (identity.kind !== 'memo') throw new Error('Expected a memo conversation');
  await withMemoStore(activeMemoScope(), (store) => store.mute(identity.memoId, until), true);
}
