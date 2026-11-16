import React, { useEffect, useRef, useState } from 'react';
import { mutedUntil, strings, type ChatListItem } from '@dologram/shared';
import { ChatOrganizationSheet } from '../components/ChatOrganizationSheet';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/Toast';
import type { FolderState } from '../folders/useFolders';
import { memoMute, memoPreference } from './organization';
import { activeMemoScope, withMemoStore } from './vault';

type Props = {
  /** Null once the parent clears its selection; the last item stays mounted for the exit. */
  item: ChatListItem | null;
  folders: Pick<FolderState, 'folders'>;
  ignored: boolean;
  onClose: () => void;
};

export function MemoOrganizationActions({ item, folders, ignored, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Keep the last selection rendered while ChatOrganizationSheet slides out.
  const [retainedItem, setRetainedItem] = useState<ChatListItem | null>(item);
  const lock = useRef(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (item) {
      // This state mirrors the latest selection solely so the parent can clear
      // `item` immediately without cutting off the closing animation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRetainedItem(item);
    }
  }, [item]);

  const displayItem = item ?? retainedItem;
  if (!displayItem) return null;

  const run = async (work: () => Promise<void>, close = true) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await work(); if (close) onClose(); }
    catch (error: unknown) { showToast({ message: error instanceof Error ? error.message : strings.organization.actionFailed, variant: 'error' }); }
    finally { lock.current = false; setBusy(false); }
  };

  return <><ChatOrganizationSheet item={displayItem} visible={item !== null && !closing && !confirmDelete}
    folders={folders.folders.map((folder) => ({ folderId: folder.folder_id, name: folder.name, containsChat: folder.chatIds.includes(displayItem.chatId) }))}
    offline={false} busy={busy} onClose={onClose} ignored={ignored}
    onPin={() => void run(() => memoPreference(displayItem.chatId, 'pinned', true))}
    onUnpin={() => void run(() => memoPreference(displayItem.chatId, 'pinned', false))}
    onArchive={() => void run(() => memoPreference(displayItem.chatId, 'archived', true))}
    onUnarchive={() => void run(() => memoPreference(displayItem.chatId, 'archived', false))}
    onIgnore={() => void run(() => memoPreference(displayItem.chatId, 'ignored', true))}
    onUnignore={() => void run(() => memoPreference(displayItem.chatId, 'ignored', false))}
    onMarkUnread={() => void run(() => memoPreference(displayItem.chatId, 'unread', true))}
    onMute={(option) => void run(() => memoMute(displayItem.chatId, mutedUntil(option, new Date())))}
    onUnmute={() => void run(() => memoMute(displayItem.chatId, null))}
    onDelete={() => { if (!lock.current) setClosing(true); }}
    onExited={() => {
      if (closing && item !== null) setConfirmDelete(true);
      setClosing(false);
    }}
    onToggleFolder={(folderId, contains) => void run(async () => {
      const identity = displayItem.conversation;
      if (identity?.kind !== 'memo') throw new Error('Memo account changed.');
      await withMemoStore(activeMemoScope(), (store) => store.folder(identity.memoId, folderId, !contains), true);
    }, false)} />
    <Dialog visible={confirmDelete} title={strings.memos.trashTitle} message={strings.memos.trashBody}
      confirmLabel={strings.organization.deleteConversation} destructive busy={busy}
      onDismiss={() => { if (!lock.current) setConfirmDelete(false); }}
      onConfirm={() => void run(async () => {
        const identity = displayItem.conversation;
        if (identity?.kind !== 'memo') throw new Error('Memo account changed.');
        await withMemoStore(activeMemoScope(), (store) => store.trash(identity.memoId, Date.now()), true);
        setConfirmDelete(false);
      })} />
  </>;
}
