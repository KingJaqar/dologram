/**
 * Sync contracts (M2-05, 6.4, D-40, D-43, D-91).
 *
 * Postgres Changes delivers INSERT and UPDATE events for messages, message_media, reactions and
 * chat members;
 * a resync fetches the rows of those three tables whose `sync_seq` is greater than the chat's
 * cursor. Everything here is platform-agnostic: the mobile app supplies the Supabase client and
 * the expo-sqlite cache, so the merge rules can be tested with a fake source and a fake store.
 * Delivery sits behind `SyncDelivery` so the Postgres Changes implementation can later be
 * replaced by database Broadcast without touching the engine (D-43).
 */
import type { DgResult } from '../db/result';
import type { MessageRow } from '../db/repositories/messages';
import type { MessageMediaRow } from '../db/repositories/media';
import type { ReactionRow } from '../db/repositories/reactions';
import type { ChatRow } from '../db/repositories/chats';
import type { ChatMemberRow } from '../db/repositories/members';
import type { ProfileRow } from '../db/repositories/profiles';

/** Published table changes, in the shape the cache stores. */
export type ChangePayload =
  | { table: 'messages'; row: MessageRow }
  | { table: 'message_media'; row: MessageMediaRow }
  | { table: 'reactions'; row: ReactionRow }
  | { table: 'chat_members'; row: ChatMemberRow };

/** Every table change addressed here belongs to exactly one chat. */
export type ChangeTable = ChangePayload['table'];

/** The connection state the engine needs: a rejoined channel triggers a catch-up resync. */
export type SyncDeliveryStatus = 'connected' | 'disconnected';

export type SyncDeliveryHandlers = {
  onChange: (change: ChangePayload) => void;
  onStatus: (status: SyncDeliveryStatus) => void;
};

/**
 * Realtime delivery interface (D-43). `subscribe` returns the unsubscribe function; the
 * implementation owns the channel and its reconnection behaviour.
 */
export interface SyncDelivery {
  subscribe(handlers: SyncDeliveryHandlers): () => void;
}

/** Server reads the resync needs. All of them are scoped by RLS, never by a client filter. */
export interface SyncSource {
  /** Rows of `messages` with sync_seq > afterSyncSeq, ascending, at most `limit`. */
  fetchMessagesAfter(
    chatId: string,
    afterSyncSeq: number,
    limit: number,
  ): Promise<DgResult<MessageRow[]>>;
  /** Rows of `message_media` with sync_seq > afterSyncSeq, ascending, at most `limit`. */
  fetchMediaAfter(
    chatId: string,
    afterSyncSeq: number,
    limit: number,
  ): Promise<DgResult<MessageMediaRow[]>>;
  /** Rows of `reactions` with sync_seq > afterSyncSeq, ascending, at most `limit`. */
  fetchReactionsAfter(
    chatId: string,
    afterSyncSeq: number,
    limit: number,
  ): Promise<DgResult<ReactionRow[]>>;
  /** Every chat the caller is a member of; drives the initial fetch and the D-91 prune. */
  fetchChats(): Promise<DgResult<ChatRow[]>>;
  /** One chat, or null when the caller is no longer a member (D-91). */
  fetchChat(chatId: string): Promise<DgResult<ChatRow | null>>;
  /** Every member row of one chat, including the caller's read state and folder flags. */
  fetchMembers(chatId: string): Promise<DgResult<ChatMemberRow[]>>;
  /**
   * Profiles of the given users, for titles and sender names (AND-03). RLS returns only users who
   * share a chat with the caller, so the chat list never needs a separate lookup.
   */
  fetchProfiles(userIds: readonly string[]): Promise<DgResult<ProfileRow[]>>;
}

/**
 * The local cache contract (6.2). Rows are merged by key, so applying the same row twice is
 * harmless (D-40); the cursor is the highest sync_seq received for the chat and never a device
 * timestamp.
 */
export interface SyncCacheStore {
  /** Opens or upgrades the cache schema. Idempotent. */
  init(): Promise<void>;
  /** Highest sync_seq received for the chat, 0 when the chat was never synced. */
  getCursor(chatId: string): Promise<number>;
  /** Raises the cursor; it must never move backwards. */
  setCursor(chatId: string, cursor: number): Promise<void>;
  hasChat(chatId: string): Promise<boolean>;
  /** Every chat id the cache holds; used to find chats the server no longer lists (D-91). */
  listChatIds(): Promise<string[]>;
  upsertChat(row: ChatRow): Promise<void>;
  upsertMember(row: ChatMemberRow): Promise<void>;
  upsertMessage(row: MessageRow): Promise<void>;
  upsertMedia(row: MessageMediaRow): Promise<void>;
  upsertReaction(row: ReactionRow): Promise<void>;
  /** Display names of chat members, merged by `user_id`. */
  upsertProfile(row: ProfileRow): Promise<void>;
  /** Removes the chat, its members, messages, media, reactions and sync cursor (D-91). */
  deleteChat(chatId: string): Promise<void>;
}

/** What one resync pass did; the dev-tools screen and later UI read it for error states. */
export type SyncSummary = {
  /** Chats the server listed for this user. */
  chats: number;
  /** Chats removed from the device because the server no longer lists them (D-91). */
  pruned: number;
  /** Chats whose resync failed; the cursor is unchanged for them. */
  failed: number;
};
