import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { strings } from '@dologram/shared';
import type { AuthProfile } from './AuthProvider';

const SAVED_ACCOUNTS_KEY = 'dg.savedAccounts';
const SKIP_SWITCH_CONFIRMATION_KEY = 'dg.skipAccountSwitchConfirmation';
export const MAX_SAVED_ACCOUNTS = 20;

export interface SavedAccount {
  userId: string;
  email: string | null;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  refreshToken: string;
  lastUsedAt: string;
}

export function toSavedAccount(session: Session, profile: AuthProfile | null): SavedAccount {
  const ownProfile = profile?.user_id === session.user.id ? profile : null;
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    username: ownProfile?.username ?? null,
    displayName: ownProfile?.display_name || strings.settings.profileFallback,
    avatarUrl: ownProfile?.avatar_url ?? null,
    refreshToken: session.refresh_token,
    lastUsedAt: new Date().toISOString(),
  };
}

export async function shouldSkipAccountSwitchConfirmation(): Promise<boolean> {
  return (await AsyncStorage.getItem(SKIP_SWITCH_CONFIRMATION_KEY)) === 'true';
}

export async function skipAccountSwitchConfirmation(): Promise<void> {
  await AsyncStorage.setItem(SKIP_SWITCH_CONFIRMATION_KEY, 'true');
}

function isSavedAccount(value: unknown): value is SavedAccount {
  if (typeof value !== 'object' || value === null) return false;
  const account = value as Partial<SavedAccount>;
  return typeof account.userId === 'string' && typeof account.refreshToken === 'string' &&
    typeof account.displayName === 'string' && typeof account.lastUsedAt === 'string';
}

async function readSavedAccounts(): Promise<SavedAccount[]> {
  const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedAccount).slice(0, MAX_SAVED_ACCOUNTS) : [];
  } catch {
    return [];
  }
}

export async function loadSavedAccounts(): Promise<SavedAccount[]> {
  await pendingWrite;
  return readSavedAccounts().catch(() => []);
}

let pendingWrite: Promise<void> = Promise.resolve();

function updateSavedAccounts(update: (accounts: SavedAccount[]) => SavedAccount[]): Promise<void> {
  const write = pendingWrite.then(async () => {
    const accounts = await readSavedAccounts();
    await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(update(accounts).slice(0, MAX_SAVED_ACCOUNTS)));
  });
  pendingWrite = write.catch(() => {});
  return write;
}

export function saveCurrentAccount(account: SavedAccount): Promise<void> {
  return updateSavedAccounts((accounts) => [account, ...accounts.filter((item) => item.userId !== account.userId)]);
}

export function saveSessionAccount(session: Session, profile: AuthProfile | null): Promise<void> {
  const account = toSavedAccount(session, profile);
  return updateSavedAccounts((accounts) => {
    const saved = accounts.find((item) => item.userId === account.userId);
    const next = saved && profile?.user_id !== session.user.id
      ? { ...saved, email: account.email, refreshToken: account.refreshToken, lastUsedAt: account.lastUsedAt }
      : account;
    return [next, ...accounts.filter((item) => item.userId !== account.userId)];
  });
}

export async function removeSavedAccount(userId: string): Promise<void> {
  await removeSavedAccounts([userId]);
}

export async function removeSavedAccounts(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const ids = new Set(userIds);
  await updateSavedAccounts((accounts) => accounts.filter((item) => !ids.has(item.userId)));
}
