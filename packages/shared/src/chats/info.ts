/**
 * Chat info display model (M2-07, AND-12, D-70, D-91).
 *
 * AND-12 shows a direct chat's other member (display name, username, initials) and a group's title
 * with its members and roles. D-70 fixes what the caller may do: a direct chat has exactly two
 * fixed members, so no member can be removed; in a group the owner adds and removes members and any
 * member may leave. Everything here is pure so those rules are unit-tested without a device.
 */
import type { ChatRow } from '../db/repositories/chats';
import type { ChatMemberRow } from '../db/repositories/members';
import type { ProfileRow } from '../db/repositories/profiles';
import { config } from '../config';
import { strings } from '../strings';

export type ChatInfoMember = {
  userId: string;
  displayName: string;
  profileDisplayName?: string;
  nickname?: string;
  /** The profile's username, or null when the cached profile is missing. */
  username: string | null;
  role: string;
  /** "Owner" for the owner; null for a member without a label of its own. */
  roleLabel: string | null;
  isSelf: boolean;
  joinedAt: string;
};

export type ChatInfoModel = {
  chatId: string;
  isGroup: boolean;
  savedMessages: boolean;
  /** Group title, the other member's display name, or "Saved Messages" (AND-12). */
  title: string;
  /** The other member's username in a direct chat, "<n> members" in a group, else "". */
  subtitle: string;
  /** Id and name the CMP-05 avatar is built from. */
  avatarId: string;
  avatarName: string;
  avatarUrl: string | null;
  isOwner: boolean;
  /** D-70: only the owner of a group adds or removes members. */
  canManageMembers: boolean;
  canAddMembers: boolean;
  /** D-70: any group member may leave; direct rows cannot be deleted. */
  canLeave: boolean;
  archived: boolean;
  muted: boolean;
  members: ChatInfoMember[];
};

export type BuildChatInfoInput = {
  chat: ChatRow;
  /** Every `chat_members` row of the chat. */
  members: readonly ChatMemberRow[];
  /** Cached profiles; a missing row falls back to the unknown-user wording (D-35). */
  profiles: readonly ProfileRow[];
  userId: string;
};

const ROLE_RANK: Record<string, number> = { owner: 0, admin: 1, member: 2 };

function roleLabelFor(role: string): string | null {
  if (role === 'owner') return strings.chatInfo.owner;
  if (role === 'admin') return strings.chatInfo.admin;
  return null;
}

function compareMembers(a: ChatMemberRow, b: ChatMemberRow): number {
  const rankA = ROLE_RANK[a.role] ?? 3;
  const rankB = ROLE_RANK[b.role] ?? 3;
  if (rankA !== rankB) return rankA - rankB;
  if (a.joined_at !== b.joined_at) return a.joined_at < b.joined_at ? -1 : 1;
  return a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0;
}

/** D-70: Saved Messages is the direct chat whose direct_key is the user id alone. */
export function isSavedMessagesChat(chat: ChatRow, userId: string): boolean {
  return chat.type === 'direct' && chat.direct_key === userId;
}

export function buildChatInfo({
  chat,
  members,
  profiles,
  userId,
}: BuildChatInfoInput): ChatInfoModel {
  const profileById = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const isGroup = chat.type === 'group';
  const savedMessages = isSavedMessagesChat(chat, userId);

  const otherMemberId = isGroup ? null : (members.find((m) => m.user_id !== userId)?.user_id ?? null);
  const otherMember = otherMemberId === null ? undefined : members.find((member) => member.user_id === otherMemberId);
  const otherProfile = otherMemberId === null ? undefined : profileById.get(otherMemberId);
  const otherDisplayName = otherMember?.nickname || otherProfile?.display_name || strings.chatList.unknownMember;

  const sorted = [...members].sort(compareMembers).map<ChatInfoMember>((member) => {
    const profile = profileById.get(member.user_id);
    return {
      userId: member.user_id,
      displayName: member.nickname || profile?.display_name || strings.chatList.unknownMember,
      profileDisplayName: profile?.display_name || strings.chatList.unknownMember,
      nickname: member.nickname ?? '',
      username: profile?.username ?? null,
      role: member.role,
      roleLabel: roleLabelFor(member.role),
      isSelf: member.user_id === userId,
      joinedAt: member.joined_at,
    };
  });

  let title: string;
  let subtitle: string;
  if (isGroup) {
    title = chat.title ?? '';
    subtitle = strings.chatInfo.membersCount(members.length);
  } else if (savedMessages) {
    title = strings.chatList.savedMessages;
    subtitle = '';
  } else {
    title = otherDisplayName;
    subtitle = otherProfile?.username ?? '';
  }

  const isOwner = members.some((m) => m.user_id === userId && m.role === 'owner');
  const ownMember = members.find((member) => member.user_id === userId);
  const muted =
    ownMember?.muted_until === 'infinity' ||
    (ownMember?.muted_until !== null && ownMember?.muted_until !== undefined
      ? Date.parse(ownMember.muted_until) > Date.now()
      : false);

  return {
    chatId: chat.chat_id,
    isGroup,
    savedMessages,
    title,
    subtitle,
    avatarId: otherMemberId ?? chat.chat_id,
    avatarName: otherDisplayName || title,
    avatarUrl: isGroup ? (chat.avatar_url ?? null) : (otherProfile?.avatar_url ?? null),
    isOwner,
    canManageMembers: isGroup && isOwner,
    canAddMembers: isGroup && isOwner && members.length < config.groups.maxMembers,
    canLeave: isGroup,
    archived: ownMember?.archived ?? false,
    muted,
    members: sorted,
  };
}
