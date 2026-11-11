/**
 * New chat, new group and chat info tests (M2-07, AND-10, AND-11, AND-12, D-58, D-70, D-91).
 *
 * The direct-chat lookup, the shared-chat contact list, the D-58 selection limit and the AND-12
 * rules (title, username, member roles, who may add, remove or leave) are pure functions.
 */
import { describe, expect, it } from 'vitest';
import type { ChatListSourceRow } from '../../chatList/types';
import type { ChatRow } from '../../db/repositories/chats';
import type { ChatMemberRow } from '../../db/repositories/members';
import type { ProfileRow } from '../../db/repositories/profiles';
import { strings } from '../../strings';
import { buildContactList, maxSelectableMembers, toggleContactSelection } from '../contacts';
import { findDirectChatId } from '../direct';
import { buildChatInfo } from '../info';

const ME = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const THIRD = '00000000-0000-4000-8000-000000000003';

function chat(id: string, overrides: Partial<ChatRow> = {}): ChatRow {
  return {
    chat_id: id,
    created_at: '2026-11-01T00:00:00.000Z',
    created_by: ME,
    direct_key: id,
    next_seq: 0,
    title: null,
    type: 'direct',
    ...overrides,
  };
}

function member(chatId: string, userId: string, overrides: Partial<ChatMemberRow> = {}): ChatMemberRow {
  return {
    archived: false,
    chat_id: chatId,
    joined_at: '2026-11-01T00:00:00.000Z',
    last_read_seq: 0,
    muted_until: null,
    role: 'member',
    user_id: userId,
    ...overrides,
  };
}

function profile(userId: string, displayName: string, username: string): ProfileRow {
  return {
    avatar_url: null,
    display_name: displayName,
    premium_flags: null,
    user_id: userId,
    username,
  };
}

function sourceRow(overrides: Partial<ChatListSourceRow> & { chat: ChatRow }): ChatListSourceRow {
  return {
    lastMediaType: null,
    lastMessage: null,
    lastSenderName: null,
    myMember: member(overrides.chat.chat_id, ME),
    otherMaxReadSeq: 0,
    otherMemberId: OTHER,
    otherMemberName: 'Grace Hopper',
    unreadCount: 0,
    ...overrides,
  };
}

describe('findDirectChatId (D-70)', () => {
  it('opens the existing direct chat with that member', () => {
    const rows = [sourceRow({ chat: chat('chat-1') })];
    expect(findDirectChatId(rows, { userId: ME, otherUserId: OTHER })).toBe('chat-1');
  });

  it('counts an archived direct chat, so archiving does not create a second one', () => {
    const rows = [
      sourceRow({ chat: chat('chat-1'), myMember: member('chat-1', ME, { archived: true }) }),
    ];
    expect(findDirectChatId(rows, { userId: ME, otherUserId: OTHER })).toBe('chat-1');
  });

  it('ignores a group that contains the same member', () => {
    const rows = [
      sourceRow({ chat: chat('chat-g', { type: 'group', title: 'Group', direct_key: null }) }),
    ];
    expect(findDirectChatId(rows, { userId: ME, otherUserId: OTHER })).toBeNull();
  });

  it('resolves Saved Messages when the caller searches for themself', () => {
    const rows = [sourceRow({ chat: chat('chat-saved', { direct_key: ME }), otherMemberId: null })];
    expect(findDirectChatId(rows, { userId: ME, otherUserId: OTHER })).toBeNull();
    expect(findDirectChatId(rows, { userId: ME, otherUserId: ME })).toBe('chat-saved');
  });
});

describe('buildContactList (D-70, D-58)', () => {
  const rows = [
    { user_id: OTHER, display_name: 'Grace Hopper' },
    { user_id: THIRD, display_name: 'ada lovelace' },
    { user_id: ME, display_name: 'Me' },
    { user_id: OTHER, display_name: 'Grace Hopper' },
    { user_id: '00000000-0000-4000-8000-000000000004', display_name: null },
  ];

  it('lists each person who shares a chat once, sorted by display name, without the caller', () => {
    const contacts = buildContactList(rows, ME);
    expect(contacts.map((c) => c.userId)).toEqual([
      THIRD,
      OTHER,
      '00000000-0000-4000-8000-000000000004',
    ]);
    expect(contacts[2]?.displayName).toBe(strings.chatList.unknownMember);
  });

  it('leaves out the members a chat already has', () => {
    const contacts = buildContactList(rows, ME, [OTHER]);
    expect(contacts.map((c) => c.userId)).toEqual([
      THIRD,
      '00000000-0000-4000-8000-000000000004',
    ]);
  });
});

describe('toggleContactSelection (D-58)', () => {
  it('adds and removes one member', () => {
    const added = toggleContactSelection([], OTHER, maxSelectableMembers);
    expect(added).toEqual([OTHER]);
    expect(toggleContactSelection(added, OTHER, maxSelectableMembers)).toEqual([]);
  });

  it('never selects more than 99 members besides the creator', () => {
    expect(maxSelectableMembers).toBe(99);
    const full = Array.from({ length: maxSelectableMembers }, (_, index) => `user-${index}`);
    const next = toggleContactSelection(full, 'one-too-many', maxSelectableMembers);
    expect(next).toHaveLength(maxSelectableMembers);
    expect(next).not.toContain('one-too-many');
    expect(toggleContactSelection(full, 'user-0', maxSelectableMembers)).toHaveLength(98);
  });
});

describe('buildChatInfo (AND-12, D-70, D-91)', () => {
  const profiles = [profile(ME, 'Me Myself', 'me'), profile(OTHER, 'Grace Hopper', 'grace')];

  it('shows a direct chat with the other member and no member management', () => {
    const info = buildChatInfo({
      chat: chat('chat-1'),
      members: [member('chat-1', ME, { role: 'owner' }), member('chat-1', OTHER)],
      profiles,
      userId: ME,
    });

    expect(info.title).toBe('Grace Hopper');
    expect(info.subtitle).toBe('grace');
    expect(info.avatarId).toBe(OTHER);
    expect(info.isGroup).toBe(false);
    expect(info.canLeave).toBe(false);
    expect(info.canManageMembers).toBe(false);
    expect(info.canAddMembers).toBe(false);
  });

  it('shows Saved Messages by name and never offers to leave it', () => {
    const info = buildChatInfo({
      chat: chat('chat-saved', { direct_key: ME }),
      members: [member('chat-saved', ME, { role: 'owner' })],
      profiles,
      userId: ME,
    });

    expect(info.savedMessages).toBe(true);
    expect(info.title).toBe(strings.chatList.savedMessages);
    expect(info.canLeave).toBe(false);
  });

  it('shows a group title, the member count and the owner first with its role', () => {
    const info = buildChatInfo({
      chat: chat('chat-g', { type: 'group', title: 'Crew', direct_key: null }),
      members: [
        member('chat-g', OTHER, { joined_at: '2026-11-02T00:00:00.000Z' }),
        member('chat-g', ME, { role: 'owner' }),
      ],
      profiles,
      userId: ME,
    });

    expect(info.title).toBe('Crew');
    expect(info.subtitle).toBe(strings.chatInfo.membersCount(2));
    expect(info.isOwner).toBe(true);
    expect(info.canLeave).toBe(true);
    expect(info.canManageMembers).toBe(true);
    expect(info.canAddMembers).toBe(true);
    expect(info.members.map((m) => m.userId)).toEqual([ME, OTHER]);
    expect(info.members[0]?.roleLabel).toBe(strings.chatInfo.owner);
    expect(info.members[1]?.roleLabel).toBeNull();
    expect(info.members[1]?.isSelf).toBe(false);
  });

  it('gives a non-owner no management rights and stops adding at 100 members', () => {
    const many = Array.from({ length: 100 }, (_, index) =>
      member('chat-g', `user-${index}`, { joined_at: '2026-11-02T00:00:00.000Z' }),
    );
    const info = buildChatInfo({
      chat: chat('chat-g', { type: 'group', title: 'Crew', direct_key: null }),
      members: many,
      profiles,
      userId: ME,
    });

    expect(info.canManageMembers).toBe(false);
    expect(info.canAddMembers).toBe(false);
    expect(info.subtitle).toBe(strings.chatInfo.membersCount(100));
  });
});
