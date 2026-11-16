'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { strings } from '@dologram/shared/src/strings';
import type { ChatListEntry } from '../../features/chatList/query';
import { Avatar } from '../Avatar/Avatar';
import { Badge } from '../Badge/Badge';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { Menu, type MenuItem } from '../Menu/Menu';
import styles from './ChatRow.module.css';

const STATUS_ICONS = {
  queued: 'status.queued',
  sending: 'status.sending',
  sent: 'status.sent',
  seen: 'status.seen',
  failed: 'status.failed',
} as const;

/**
 * CMP-09 row: avatar, name, time, own delivery status, one-line preview and the unread Badge.
 * The row is a link; the CMP-23 menu opens from its own button, from right-click and from
 * Shift+F10 on the link (D-94, CMP-08). Archive, Mute and Add to folder arrive in Phase 18, so the
 * only item in this phase is Leave group for a group chat (Phase 11 supplies the action).
 */
export function ChatRow({ item }: { item: ChatListEntry }) {
  const pathname = usePathname();
  const active = pathname === `/chat/${item.chatId}`;
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const items: MenuItem[] = item.isGroup
    ? [{ id: 'leave', label: strings.organization.leaveGroup, onSelect: () => undefined, disabledReason: strings.chatList.leaveUnavailable }]
    : [];

  return (
    <li className={styles.row} data-active={active || undefined} data-unread={item.unreadCount > 0 || undefined}>
      <Link
        href={`/chat/${item.chatId}`}
        className={styles.link}
        aria-label={item.accessibilityLabel}
        aria-current={active ? 'page' : undefined}
        onContextMenu={(event) => { if (items.length > 0) { event.preventDefault(); setOpen(true); } }}
        onKeyDown={(event) => {
          if (items.length === 0) return;
          if (event.key === 'F10' && event.shiftKey) { event.preventDefault(); setOpen(true); }
        }}
      >
        <Avatar id={item.avatarId} displayName={item.avatarName} size={56} variant={item.savedMessages ? 'saved' : 'normal'} />
        <span className={styles.text} aria-hidden="true">
          <span className={styles.top}>
            <span className={styles.title}>{item.title}</span>
            {item.muted && <Icon name="action.mute" size="sm" className={styles.mutedIcon} />}
            <span className={styles.time}>{item.timeLabel}</span>
          </span>
          <span className={styles.bottom}>
            {item.ownLastStatus !== null && (
              <Icon
                name={STATUS_ICONS[item.ownLastStatus]}
                size="sm"
                className={item.ownLastStatus === 'failed' ? styles.failedIcon : styles.statusIcon}
              />
            )}
            <span className={styles.preview}>{item.preview}</span>
            {item.unreadCount > 0 && (
              <Badge variant={item.muted ? 'muted' : 'brand'}>{item.unreadCount}</Badge>
            )}
          </span>
        </span>
      </Link>
      {items.length > 0 && (
        <>
          <IconButton
            ref={anchor}
            icon="nav.more"
            label={`${strings.chat.more}: ${item.title}`}
            className={styles.more}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          />
          <Menu open={open} onClose={() => setOpen(false)} anchorRef={anchor} label={item.title} items={items} />
        </>
      )}
    </li>
  );
}
