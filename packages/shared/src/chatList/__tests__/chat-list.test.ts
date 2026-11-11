/**
 * Chat list tests (M2-08, F2, AND-03, AND-04, CMP-09, D-44, D-94).
 *
 * D-94 order and archive split, the CMP-09 previews, the unread count carry-through, the mute
 * flag, the Seen status rule of D-92 and the D-109 time labels are all pure functions.
 */
import { describe, expect, it } from 'vitest';
import type { ChatRow } from '../../db/repositories/chats';
import type { ChatMemberRow } from '../../db/repositories/members';
import type { MessageRow } from '../../db/repositories/messages';
import { strings } from '../../strings';
import { buildChatList } from '../build';
import { formatChatListTime } from '../format';
import { messagePreview, stripMarkdown } from '../preview';
import type { ChatListSourceRow } from '../types';

const ME = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const NOW = new Date('2026-11-10T12:00:00.000Z');

function chat(id: string, overrides: Partial<ChatRow> = {}): ChatRow {
  return {
    chat_id: id,
    created_at: '2026-11-01T00:00:00.000Z',
    created_by: ME,
    direct_key: id,
    next_seq: 10,
    title: null,
    type: 'direct',
    ...overrides,
  };
}

function member(id: string, overrides: Partial<ChatMemberRow> = {}): ChatMemberRow {
  return {
    archived: false,
    chat_id: id,
    joined_at: '2026-11-01T00:00:00.000Z',
    last_read_seq: 0,
    muted_until: null,
    role: 'member',
    user_id: ME,
    ...overrides,
  };
}

function message(
  chatId: string,
  id: string,
  seq: number,
  overrides: Partial<MessageRow> = {},
): MessageRow {
  return {
    attachment_count: 0,
    chat_id: chatId,
    content: 'hello',
    created_at: '2026-11-10T09:00:00.000Z',
    deleted_at: null,
    edited_at: null,
    message_id: id,
    reply_to: null,
    sender_id: ME,
    seq,
    sync_seq: seq,
    ...overrides,
  };
}

function row(overrides: Partial<ChatListSourceRow> & { chat: ChatRow }): ChatListSourceRow {
  return {
    lastMediaType: null,
    lastMessage: null,
    lastSenderName: null,
    myMember: member(overrides.chat.chat_id),
    otherMaxReadSeq: 0,
    otherMemberId: OTHER,
    otherMemberName: 'Grace Hopper',
    unreadCount: 0,
    ...overrides,
  };
}

const OPTS = { userId: ME, now: NOW, locale: 'en-US', timeZone: 'UTC' };

describe('conversation organization', () => {
  const rows = [
    row({ chat: chat('active') }),
    row({ chat: chat('archived'), myMember: member('archived', { archived: true }) }),
    row({ chat: chat('visible') }),
  ];

  it('lists ignored chats from both archive states and restores their original location', () => {
    const options = { ...OPTS, ignoredChatIds: ['active', 'archived'] };
    expect(buildChatList(rows, options).map((item) => item.chatId)).toEqual(['visible']);
    expect(buildChatList(rows, { ...options, archived: true })).toEqual([]);
    const ignored = buildChatList(rows, { ...options, ignored: true });
    expect(ignored.map((item) => item.chatId)).toEqual(['active', 'archived']);
    expect(ignored.map((item) => item.archived)).toEqual([false, true]);
    expect(buildChatList(rows, { ...OPTS, archived: true }).map((item) => item.chatId)).toEqual(['archived']);
  });

  it('keeps deleted chats out of all lists after a resync', () => {
    const options = { ...OPTS, deletedChatIds: ['active', 'archived'], ignoredChatIds: ['active', 'archived'] };
    expect(buildChatList(rows, options).map((item) => item.chatId)).toEqual(['visible']);
    expect(buildChatList(rows, { ...options, archived: true })).toEqual([]);
    expect(buildChatList(rows, { ...options, ignored: true })).toEqual([]);
  });

  it('pins above newer conversations and unpinning restores chronological order', () => {
    const chats = [row({ chat: chat('old') }), row({ chat: chat('new'), lastMessage: message('new', 'm', 1) })];
    expect(buildChatList(chats, { ...OPTS, pinnedChatIds: ['old'] }).map((item) => item.chatId)).toEqual(['old', 'new']);
    expect(buildChatList(chats, OPTS).map((item) => item.chatId)).toEqual(['new', 'old']);
  });

  it('marks own, empty, and saved conversations unread without decreasing read receipts', () => {
    const source = row({ chat: chat('saved'), otherMemberId: null, lastMessage: message('saved', 'm', 10), myMember: member('saved', { last_read_seq: 10 }) });
    const item = buildChatList([source], { ...OPTS, unreadChatIds: ['saved'] })[0];
    expect(item?.unreadCount).toBe(1);
    expect(item?.accessibilityLabel).toContain('1 unread');
    expect(source.myMember.last_read_seq).toBe(10);
    expect(buildChatList([source], OPTS)[0]?.unreadCount).toBe(0);
    expect(buildChatList(rows, { ...OPTS, unreadChatIds: ['active'] })[0]?.unreadCount).toBe(1);
  });

  it('only offers invitations to group owners', () => {
    const owner = row({ chat: chat('owner', { type: 'group' }), myMember: member('owner', { role: 'owner' }) });
    const regular = row({ chat: chat('member', { type: 'group' }) });
    const items = buildChatList([owner, regular], OPTS);
    expect(items.find((item) => item.chatId === 'owner')?.canAddMembers).toBe(true);
    expect(items.find((item) => item.chatId === 'member')?.canAddMembers).toBe(false);
  });
});

describe('buildChatList order and archive (D-94)', () => {
  it('orders by the newest message first and leaves archived chats out of the main list', () => {
    const rows = [
      row({
        chat: chat('chat-old'),
        lastMessage: message('chat-old', 'm1', 1, { created_at: '2026-11-09T10:00:00.000Z' }),
      }),
      row({
        chat: chat('chat-new'),
        lastMessage: message('chat-new', 'm2', 1, { created_at: '2026-11-10T10:00:00.000Z' }),
      }),
      row({
        chat: chat('chat-archived'),
        myMember: member('chat-archived', { archived: true }),
        lastMessage: message('chat-archived', 'm3', 1, { created_at: '2026-11-10T11:00:00.000Z' }),
      }),
    ];

    const main = buildChatList(rows, OPTS);
    expect(main.map((item) => item.chatId)).toEqual(['chat-new', 'chat-old']);

    const archive = buildChatList(rows, { ...OPTS, archived: true });
    expect(archive.map((item) => item.chatId)).toEqual(['chat-archived']);
    expect(archive[0]?.archived).toBe(true);
  });

  it('falls back to chats.created_at for a chat with no messages and breaks ties by chat_id', () => {
    const rows = [
      row({ chat: chat('chat-b', { created_at: '2026-11-05T00:00:00.000Z' }) }),
      row({ chat: chat('chat-a', { created_at: '2026-11-05T00:00:00.000Z' }) }),
      row({
        chat: chat('chat-c', { created_at: '2026-11-01T00:00:00.000Z' }),
        lastMessage: message('chat-c', 'm1', 1, { created_at: '2026-11-02T00:00:00.000Z' }),
      }),
    ];

    expect(buildChatList(rows, OPTS).map((item) => item.chatId)).toEqual([
      'chat-a',
      'chat-b',
      'chat-c',
    ]);
  });
});

describe('buildChatList titles and previews (AND-03, CMP-09)', () => {
  it('titles a group by its title, a direct chat by the other member and the own chat as Saved Messages', () => {
    const rows = [
      row({
        chat: chat('group', { type: 'group', title: 'Fixture group', direct_key: null }),
      }),
      row({ chat: chat('direct') }),
      row({ chat: chat('saved'), otherMemberId: null, otherMemberName: null }),
    ];

    const items = buildChatList(rows, OPTS);
    const byId = new Map(items.map((item) => [item.chatId, item]));

    expect(byId.get('group')?.title).toBe('Fixture group');
    expect(byId.get('direct')?.title).toBe('Grace Hopper');
    expect(byId.get('saved')?.title).toBe(strings.chatList.savedMessages);
    expect(byId.get('saved')?.savedMessages).toBe(true);
    expect(byId.get('saved')?.ownStatus).toBeNull();
  });

  it('strips Markdown from the preview and prefixes it with the sender in a group', () => {
    const rows = [
      row({
        chat: chat('group', { type: 'group', title: 'Fixture group', direct_key: null }),
        lastMessage: message('group', 'm1', 3, {
          content: '**bold** and _italic_ with `code`',
          sender_id: OTHER,
        }),
        lastSenderName: 'Grace Hopper',
      }),
      row({
        chat: chat('direct'),
        lastMessage: message('direct', 'm2', 4, { content: 'hello [link](https://example.com)' }),
      }),
    ];

    const byId = new Map(buildChatList(rows, OPTS).map((item) => [item.chatId, item]));

    expect(byId.get('group')?.preview).toBe('Grace Hopper: bold and italic with code');
    expect(byId.get('direct')?.preview).toBe('hello link');
  });

  it('uses "You: " for the caller and the attachment word when a message has no text', () => {
    const rows = [
      row({
        chat: chat('group', { type: 'group', title: 'Fixture group', direct_key: null }),
        lastMessage: message('group', 'm1', 3, { content: '' }),
        lastMediaType: 'photo',
      }),
      row({
        chat: chat('direct'),
        lastMessage: message('direct', 'm2', 4, { content: '', attachment_count: 1 }),
        lastMediaType: 'voice',
      }),
    ];

    const byId = new Map(buildChatList(rows, OPTS).map((item) => [item.chatId, item]));

    expect(byId.get('group')?.preview).toBe(`${strings.chatList.youPrefix}${strings.chat.previewPhoto}`);
    expect(byId.get('direct')?.preview).toBe(strings.chat.previewVoice);
  });

  it('shows "Deleted message" for a soft-deleted newest message', () => {
    const rows = [
      row({
        chat: chat('direct'),
        lastMessage: message('direct', 'm1', 3, {
          content: '',
          deleted_at: '2026-11-10T10:00:00.000Z',
        }),
      }),
    ];

    expect(buildChatList(rows, OPTS)[0]?.preview).toBe(strings.chat.deletedMessage);
  });
});

describe('buildChatList unread, mute and status (D-92, D-24, CMP-09)', () => {
  it('carries the unread count the single query computed', () => {
    const rows = [row({ chat: chat('direct'), unreadCount: 5 })];
    const item = buildChatList(rows, OPTS)[0];

    expect(item?.unreadCount).toBe(5);
    expect(item?.accessibilityLabel).toContain('5 unread');
  });

  it('marks a chat muted while muted_until is in the future or "Until I unmute"', () => {
    const rows = [
      row({ chat: chat('future'), myMember: member('future', { muted_until: '2026-11-11T00:00:00.000Z' }) }),
      row({ chat: chat('past'), myMember: member('past', { muted_until: '2026-11-09T00:00:00.000Z' }) }),
      row({ chat: chat('forever'), myMember: member('forever', { muted_until: 'infinity' }) }),
    ];

    const byId = new Map(buildChatList(rows, OPTS).map((item) => [item.chatId, item]));

    expect(byId.get('future')?.muted).toBe(true);
    expect(byId.get('past')?.muted).toBe(false);
    expect(byId.get('forever')?.muted).toBe(true);
    expect(byId.get('future')?.accessibilityLabel).toContain('muted');
  });

  it('shows Seen only when another member has read the caller’s newest message', () => {
    const rows = [
      row({
        chat: chat('seen'),
        lastMessage: message('seen', 'm1', 7),
        otherMaxReadSeq: 7,
      }),
      row({
        chat: chat('sent'),
        lastMessage: message('sent', 'm2', 7),
        otherMaxReadSeq: 6,
      }),
      row({
        chat: chat('theirs'),
        lastMessage: message('theirs', 'm3', 7, { sender_id: OTHER }),
        otherMaxReadSeq: 7,
      }),
    ];

    const byId = new Map(buildChatList(rows, OPTS).map((item) => [item.chatId, item]));

    expect(byId.get('seen')?.ownStatus).toBe('seen');
    expect(byId.get('sent')?.ownStatus).toBe('sent');
    expect(byId.get('theirs')?.ownStatus).toBeNull();
  });
});

describe('D-109 time labels', () => {
  it('shows the time today, "Yesterday", a weekday within a week, then the date', () => {
    expect(formatChatListTime('2026-11-10T09:05:00.000Z', NOW, OPTS)).toContain('09:05');
    expect(formatChatListTime('2026-11-09T23:00:00.000Z', NOW, OPTS)).toBe(
      strings.chatList.yesterday,
    );
    expect(formatChatListTime('2026-11-07T10:00:00.000Z', NOW, OPTS)).toBe('Sat');
    expect(formatChatListTime('2026-10-01T10:00:00.000Z', NOW, OPTS)).toBe('Oct 1, 2026');
    expect(formatChatListTime('not a date', NOW, OPTS)).toBe('');
  });
});

describe('preview helpers', () => {
  it('removes Markdown markers and flattens the text to one line', () => {
    expect(stripMarkdown('# Title\n\n- one\n- two')).toBe('Title one two');
    expect(stripMarkdown('**bold** ~~gone~~ [text](https://example.com)')).toBe('bold gone text');
    expect(stripMarkdown('snake_case_name')).toBe('snake_case_name');
  });

  it('prefers the text, then the attachment word, then an empty preview', () => {
    expect(messagePreview(message('c', 'm1', 1, { content: 'hi' }), 'photo')).toBe('hi');
    expect(messagePreview(message('c', 'm2', 1, { content: '   ' }), 'video')).toBe(
      strings.chat.previewVideo,
    );
    expect(messagePreview(message('c', 'm3', 1, { content: '', attachment_count: 1 }), null)).toBe(
      strings.chat.previewFile,
    );
    expect(messagePreview(message('c', 'm4', 1, { content: '' }), null)).toBe('');
  });
});
