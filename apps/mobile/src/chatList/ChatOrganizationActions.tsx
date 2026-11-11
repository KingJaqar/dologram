import React, { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { mutedUntil, removeMember, strings, updateOwnMember, type ChatListItem } from '@dologram/shared';
import { useAuth } from '../auth/AuthProvider';
import { useNetState } from '../net/netState';
import { supabase } from '../lib/supabase';
import { getLocalDatabase } from '../queue/db';
import { cacheMembers } from '../chat/readState';
import { actionToast, type ToastAction, type ToastDetails } from '../notifications/toastCopy';
import type { FolderState } from '../folders/useFolders';
import { deleteCachedChat } from '../sync/localCache';
import { notifyCacheChange } from '../sync/cacheEvents';
import { ChatOrganizationSheet } from '../components/ChatOrganizationSheet';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/Toast';
import { setChatListPreference } from './preferences';
import { deleteChatFromDevice } from './deleteChat';

type Props = { item: ChatListItem | null; folders: FolderState; ignored?: boolean; onClose: () => void };

/** One action implementation for the inbox, archive, and ignored chats. */
export function ChatOrganizationActions({ item, folders, ignored = false, onClose }: Props) {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const net = useNetState();
  const { showToast } = useToast();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<'leave' | 'delete' | null>(null);

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
      await cacheMembers(await getLocalDatabase(), [result.data]).catch(() => undefined);
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
        await deleteCachedChat(await getLocalDatabase(), item.chatId);
        notifyCacheChange();
      });
    }
  };

  return (
    <>
      <ChatOrganizationSheet
        visible={item !== null && confirmation === null}
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
        onAddMembers={() => {
          if (!item || lock.current) return;
          onClose();
          router.push({ pathname: '/chat/[chatId]/info', params: { chatId: item.chatId, action: 'add-members' } });
        }}
        onMute={(option) => updateMember({ muted_until: mutedUntil(option, new Date()) }, 'muteChat', { mute: option })}
        onUnmute={() => updateMember({ muted_until: null }, 'unmuteChat')}
        onMarkUnread={() => preference('unread', true)}
        onLeaveGroup={() => setConfirmation('leave')}
        onDelete={!item?.isGroup ? () => setConfirmation('delete') : undefined}
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
