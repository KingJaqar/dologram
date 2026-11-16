import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { mutedUntil, removeMember, strings, updateOwnMember, type ChatListItem } from '@dologram/shared';
import { useAuth } from '../auth/AuthProvider';
import { useNetState } from '../net/netState';
import { supabase } from '../lib/supabase';
import { getLocalDatabase } from '../queue/db';
import { cacheMember } from '../chat/readState';
import { actionToast, type ToastAction, type ToastDetails } from '../notifications/toastCopy';
import type { FolderState } from '../folders/useFolders';
import { removeCachedMembership } from '../sync/localCache';
import { notifyCacheChange } from '../sync/cacheEvents';
import { ChatOrganizationSheet } from '../components/ChatOrganizationSheet';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/Toast';
import { setChatListPreference } from './preferences';
import { updateChatPreferences } from '../chats/preferences';
import { deleteChatFromDevice } from './deleteChat';
import { MemoOrganizationActions } from '../memos/MemoOrganizationActions';

type Props = { item: ChatListItem | null; folders: FolderState; ignored?: boolean; blocked?: boolean; onClose: () => void };

/** One action implementation for the inbox, archive, and ignored chats. */
export function ChatOrganizationActions({ item, folders, ignored = false, blocked = false, onClose }: Props) {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const net = useNetState();
  const { showToast } = useToast();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<'leave' | 'delete' | null>(null);
  // Group actions that change what is on screen (a route push, or the leave
  // confirmation dialog) are held until the sheet finishes sliding down.
  // Starting them while the sheet is still animating cuts the exit short, so
  // the menu appears to vanish instead of closing like the single-chat menu.
  const pendingRef = useRef<(() => void) | null>(null);
  const [closing, setClosing] = useState(false);
  // Hold the last selection so the memo branch survives the parent clearing
  // the item; otherwise the memo sheet unmounts instead of sliding down.
  const [retainedItem, setRetainedItem] = useState<ChatListItem | null>(item);

  useEffect(() => {
    if (item) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRetainedItem(item);
    }
  }, [item]);

  const run = async (action: () => Promise<void>, close = true, feedback?: ToastAction, details?: ToastDetails) => {
    if (!item || !userId || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await action();
      if (feedback) showToast(actionToast(feedback, 'success', details));
      if (close) {
        setConfirmation(null);
        onClose();
      }
    } catch {
      showToast(feedback ? actionToast(feedback, 'error', details) : { message: strings.organization.actionFailed, variant: 'error' });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const preference = (key: 'pinned' | 'ignored' | 'unread', enabled: boolean) => {
    if (!item || !userId) return;
    const feedback: ToastAction = key === 'pinned' ? enabled ? 'starChat' : 'unstarChat' : key === 'ignored' ? enabled ? 'ignoreChat' : 'unignoreChat' : 'markUnread';
    void run(async () => { await setChatListPreference(userId, item.chatId, key, enabled); }, true, feedback);
  };

  const updateMember = (patch: Parameters<typeof updateOwnMember>[3], feedback: ToastAction, details?: ToastDetails) => {
    if (!item || !userId || !net.isConnected) return;
    void run(async () => {
      const result = await updateOwnMember(supabase, item.chatId, userId, patch);
      if (result.error) throw result.error;
      // Server mutation is confirmed; a cache refresh failure must not invite a duplicate mutation.
      await cacheMember(await getLocalDatabase(), result.data).catch(() => undefined);
      notifyCacheChange();
    }, true, feedback, details);
  };

  const confirm = () => {
    if (!item || !userId) return;
    if (confirmation === 'delete') {
      void run(() => deleteChatFromDevice(userId, item.chatId), true, 'deleteChat');
    } else if (confirmation === 'leave' && net.isConnected) {
      void run(async () => {
        const result = await removeMember(supabase, item.chatId, userId);
        if (result.error) throw result.error;
        await removeCachedMembership(await getLocalDatabase(), item.chatId, userId);
        notifyCacheChange();
      });
    }
  };

  const displayItem = item ?? retainedItem;
  if (displayItem?.conversation?.kind === 'memo') {
    return <MemoOrganizationActions item={item} folders={folders} ignored={ignored} onClose={onClose} />;
  }
  return (
    <>
      <ChatOrganizationSheet
        visible={item !== null && confirmation === null && !closing}
        item={item}
        folders={folders.folders.map((folder) => ({
          folderId: folder.folder_id, name: folder.name, containsChat: folder.chatIds.includes(item?.chatId ?? ''),
        }))}
        offline={!net.isConnected}
        busy={busy}
        onClose={() => { if (!lock.current) onClose(); }}
        onPin={() => preference('pinned', true)}
        onUnpin={() => preference('pinned', false)}
        onArchive={() => updateMember({ archived: true }, 'archiveChat')}
        onUnarchive={() => updateMember({ archived: false }, 'unarchiveChat')}
        ignored={ignored}
        onIgnore={() => preference('ignored', true)}
        onUnignore={() => preference('ignored', false)}
        blocked={blocked}
        onUnblock={() => {
          if (!item || !userId) return;
          void run(async () => {
            await updateChatPreferences(userId, item.chatId, { blocked: false });
            notifyCacheChange();
          }, true, 'unblockChat');
        }}
        onAddMembers={() => {
          if (!item || lock.current) return;
          const chatId = item.chatId;
          pendingRef.current = () => router.push({ pathname: '/chat/[chatId]/info', params: { chatId, action: 'add-members' } });
          setClosing(true);
          onClose();
        }}
        onMute={(option) => updateMember({ muted_until: mutedUntil(option, new Date()) }, 'muteChat', { mute: option })}
        onUnmute={() => updateMember({ muted_until: null }, 'unmuteChat')}
        onMarkUnread={() => preference('unread', true)}
        onLeaveGroup={() => {
          pendingRef.current = () => setConfirmation('leave');
          setClosing(true);
        }}
        onDelete={() => {
          pendingRef.current = () => setConfirmation('delete');
          setClosing(true);
        }}
        onExited={() => {
          setClosing(false);
          const pending = pendingRef.current;
          pendingRef.current = null;
          pending?.();
        }}
        onToggleFolder={(folderId, containsChat) => {
          if (!item || !net.isConnected) return;
          const folder = folders.folders.find((candidate) => candidate.folder_id === folderId);
          if (!folder) return;
          void run(async () => {
            const ids = containsChat ? folder.chatIds.filter((id) => id !== item.chatId) : [...folder.chatIds, item.chatId];
            const error = await folders.setChats(folderId, ids);
            if (error) throw error;
          }, false, containsChat ? 'removeFromFolder' : 'addToFolder', { folder: folder.name });
        }}
      />
      <Dialog
        visible={confirmation !== null}
        title={confirmation === 'leave' ? strings.chatInfo.leaveTitle : strings.chatInfo.deleteTitle}
        message={confirmation === 'leave' ? strings.chatInfo.leaveBody : strings.chatInfo.deleteBody}
        confirmLabel={confirmation === 'leave' ? strings.chatInfo.leave : strings.organization.deleteConversation}
        onConfirm={confirm}
        onDismiss={() => { if (!lock.current) setConfirmation(null); }}
        busy={busy}
        confirmDisabled={confirmation === 'leave' && !net.isConnected}
        destructive
      />
    </>
  );
}
