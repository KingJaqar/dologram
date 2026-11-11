export const sharedReady = true;

/** DB types contract – contract-derived, pending M1-01…M1-06 (see docs/test-results/android/phase-01.md). */
export type { Database } from './db/database.types';

/** Config and constants. */
export type { DgConfig, MediaType, MuteOptionId } from './config';
export { classifyError, messageKeyFor } from './errors';
export type { ClassifiedError, DgResult, ErrorMessageKey } from './errors';
export type { FindUserRow } from './db/repositories/profiles';
export { config, mutedUntil } from './config';
export { validateEmail, validateNewPassword, validateUsername, validateDisplayName } from './validation/account';
export { validateMessageText } from './validation/message';
export { validateAttachment, validateAttachmentCount } from './validation/attachment';
export { validateGroupTitle, validateFolderName } from './validation/chat';
export { codePointLength, dgTrim, isBlank } from './validation/text';
export { createIdGenerator } from './ids';
export { strings } from './strings';
export { createDgClient } from './db/client';
export type { DgClient, DgFetch, DgStorage } from './db/client';
export {
  insertMessage,
  editMessage,
  softDeleteMessage,
  listMessagesAfter,
} from './db/repositories/messages';
export { addReaction, setReactionRemoved, listReactionsAfter } from './db/repositories/reactions';
export { updateOwnMember, listChatMembers, insertMember, removeMember, setChatNickname } from './db/repositories/members';
export type { InsertMemberInput, MemberRole } from './db/repositories/members';
export { listMyChats, getChat, createChat, updateChatTitle, updateChatAvatar } from './db/repositories/chats';
export type { CreateChatInput } from './db/repositories/chats';
export {
  createMediaSignedUrl,
  deleteChatAttachment,
  insertMessageMedia,
  isAlreadyExistsError,
  listMessageMediaAfter,
  mediaBucket,
  mediaStoragePath,
  uploadAttachment,
} from './db/repositories/media';
export type {
  InsertMessageMediaInput,
  MediaUploadOptions,
  ResumableMediaUpload,
  UploadAttachmentInput,
} from './db/repositories/media';
export { findUser, listProfilesByIds } from './db/repositories/profiles';
export type { ProfileRow } from './db/repositories/profiles';
export {
  addChatToFolder,
  createFolder,
  deleteFolder,
  listMyFolderChats,
  listMyFolders,
  removeChatFromFolder,
  renameFolder,
} from './db/repositories/folders';
export type { CreateFolderInput, FolderChatRow, FolderRow } from './db/repositories/folders';
/** Chat list (M2-08, F2, AND-03, AND-04, D-44, D-94). */
export { buildChatList, formatChatListTime, messagePreview, stripMarkdown } from './chatList';
export type {
  BuildChatListOptions,
  ChatListItem,
  ChatListOwnStatus,
  ChatListSourceRow,
} from './chatList';

/** New chat, new group and chat info (M2-07, AND-10, AND-11, AND-12, D-70, D-91). */
export {
  buildChatInfo,
  buildContactList,
  findDirectChatId,
  isSavedMessagesChat,
  maxSelectableMembers,
  toggleContactSelection,
} from './chats';
export type {
  BuildChatInfoInput,
  CachedContactRow,
  ChatInfoMember,
  ChatInfoModel,
  ContactCandidate,
  DirectChatLookup,
} from './chats';

export type { ChatRow } from './db/repositories/chats';
export type { ChatMemberRow } from './db/repositories/members';
export type { MessageRow } from './db/repositories/messages';
export type { MessageMediaRow } from './db/repositories/media';
export type { ReactionRow } from './db/repositories/reactions';

/** Shared private Broadcast topics (D-57, D-92, D-118, proposed D-152). */
export { chatTopic, realtimeEvents } from './realtime/topics';
export type { ReadBroadcast, TypingBroadcast } from './realtime/topics';

/** Sync module (M2-05, 6.4, D-40, D-43, D-91). */
export { createSyncEngine } from './sync/engine';
export type { SyncEngine, SyncEngineDeps } from './sync/engine';
export type {
  ChangePayload,
  ChangeTable,
  SyncCacheStore,
  SyncDelivery,
  SyncDeliveryHandlers,
  SyncDeliveryStatus,
  SyncSource,
  SyncSummary,
} from './sync/types';

/** Local queue core (M2-02, M2-03, LS-1 to LS-9, D-27, D-77, D-93). */
export { backoffDelayMs, nextAttemptAt, rateLimitDelayMs } from './queue/backoff';
export { createQueueCore } from './queue/core';
export { createQueueRunner } from './queue/runner';
export type {
  AttemptOutcome,
  AttemptRecord,
  AttachmentDeliverFn,
  DeliveryResult,
  DeliverFn,
  DiscardOptions,
  DiscardResult,
  DrainSummary,
  EnqueueResult,
  LocalQueueStore,
  QueueCore,
  QueueCoreDeps,
  QueueItem,
  QueuePayload,
  QueuedAttachment,
  QueueRunner,
  QueueStatus,
  QueueTiming,
  RetryResult,
  TextQueuePayload,
} from './queue';

/** Theme modules */
export { dologramColors, color, avatarFills, space, radius, elevation, motion, z, typeTokens, tokens } from './theme/tokens';
export type { ColorToken, ColorScheme, TypeToken, TypeTokenKey, SpaceToken, RadiusToken, ElevationToken, MotionDurationToken, ZToken } from './theme/tokens';
export { contrastRatio, passesContrast } from './theme/contrast';
export { iconNames, iconMap, iconSizes } from './theme/icons';
export type { IconSize } from './theme/icons';
export { textStyle, maxFontSizeMultiplier, fontFamilies } from './theme/typography';
export type { FontFamily } from './theme/typography';
