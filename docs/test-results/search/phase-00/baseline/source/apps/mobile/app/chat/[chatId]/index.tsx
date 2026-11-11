/** AND-05 chat screen (M2-09, M2-11, M2-12, F3, F6, F7, D-57, D-92, D-118, D-143). */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  addReaction,
  config,
  dgTrim,
  editMessage,
  listChatMembers,
  setReactionRemoved,
  softDeleteMessage,
  strings,
  updateOwnMember,
  validateMessageText,
} from '@dologram/shared';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useNetState } from '../../../src/net/netState';
import { isLowSignalActive } from '../../../src/net/lowSignal';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { actionToast, performToastAction } from '../../../src/notifications/toastCopy';
import { useToast } from '../../../src/components/Toast';
import { TopBar } from '../../../src/components/TopBar';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';
import { Button, IconButton } from '../../../src/components/Button';
import { Icon } from '../../../src/components/Icon';
import { OfflineBanner } from '../../../src/components/ConnectionBanner';
import { EmptyState } from '../../../src/components/EmptyState';
import { DateSeparator, JumpToBottom, UnreadDivider } from '../../../src/components/DateSeparator';
import { ChatComposer } from '../../../src/components/ChatComposer';
import { MessageBubble, type BubbleStatus } from '../../../src/components/MessageBubble';
import { MessageFocusOverlay } from '../../../src/components/MessageFocusOverlay';
import { Dialog } from '../../../src/components/Dialog';
import { loadCachedReaction, loadChatSnapshot, loadChatSnapshotForMessage, mergeChatSnapshots, type ChatMessageItem, type ChatScreenSnapshot } from '../../../src/chat/query';
import { useCall } from '../../../src/calls/useCall';
import { cacheMembers, flushPendingReadStates, markChatRead, type ReadStateSender } from '../../../src/chat/readState';
import { updateChatListPreferences } from '../../../src/chatList/preferences';
import { startChatRealtime, type ChatRealtimeHandle } from '../../../src/chat/realtime';
import { getLocalDatabase } from '../../../src/queue/db';
import { discardQueueItem, enqueueTextMessage, retryQueueItem } from '../../../src/queue/localQueue';
import { subscribeQueueChange } from '../../../src/queue/events';
import { notifyCacheChange, subscribeCacheChange } from '../../../src/sync/cacheEvents';
import { createSqliteCacheStore } from '../../../src/sync/cacheStore';
import { enqueueAttachmentMessage } from '../../../src/queue/attachments';
import { draftFromMediaLibraryAsset, pickAttachments, type PickerKind } from '../../../src/media/pickers';
import { remainingAttachments, type DraftAttachment } from '../../../src/media/model';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { useDelayedFlag } from '../../../src/hooks/useDelayedFlag';
import { DelayedActivityIndicator } from '../../../src/components/DelayedActivityIndicator';
import { MediaPickerPanel, type MediaLibraryAsset } from '../../../src/components/MediaPickerPanel';
import {
  CHAT_THEME_OPTIONS,
  loadChatPreferences,
  loadPinnedMessageIds,
  savePinnedMessageIds,
  type ChatPreferences,
} from '../../../src/chats/preferences';

type TypingEntry = { name: string; expiresAt: number };

function resolvedParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : value?.[0] ?? '';
}

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((today.getTime() - day.getTime()) / 86400000);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { dateStyle: 'medium' })} ${time}`;
}

function shouldSeparate(previous: ChatMessageItem | undefined, current: ChatMessageItem): boolean {
  if (!previous) return true;
  const previousDate = new Date(previous.createdAt);
  const currentDate = new Date(current.createdAt);
  const gap = currentDate.getTime() - previousDate.getTime();
  return previousDate.toDateString() !== currentDate.toDateString() || gap >= 60 * 60 * 1000;
}

function maxDeliveredSeq(messages: readonly ChatMessageItem[]): number {
  return messages.reduce((max, message) => (message.seq === null ? max : Math.max(max, message.seq)), 0);
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ chatId?: string | string[]; focusMessageId?: string | string[] }>();
  const chatId = resolvedParam(params.chatId);
  const focusMessageId = resolvedParam(params.focusMessageId);
  const router = useRouter();
  const { session } = useAuth();
  const theme = useTheme();
  const call = useCall();
  const net = useNetState();
  const toast = useToast();
  const userId = session?.user.id ?? '';
  const listRef = useRef<FlatList<ChatMessageItem>>(null);
  const realtimeRef = useRef<ChatRealtimeHandle | null>(null);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const snapshotRef = useRef<ChatScreenSnapshot | null>(null);
  const historicalEnd = useRef<number | undefined>(undefined);
  const followFocus = useRef(true);
  const scrolledToMessage = useRef('');
  const scrollToLatest = useRef(false);
  const [viewingHistory, setViewingHistory] = useState(false);
  const lastTypingSentRef = useRef(0);
  const [snapshot, setSnapshot] = useState<ChatScreenSnapshot | null>(null);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [attachMenu, setAttachMenu] = useState(false);
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const sendLock = useRef(false);
  const pickLock = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTimeId, setShowTimeId] = useState<string | null>(null);
  const [typing, setTyping] = useState<Map<string, TypingEntry>>(new Map());
  const [atBottom, setAtBottom] = useState(true);
  const [focusMessage, setFocusMessage] = useState<ChatMessageItem | null>(null);
  const showLoading = useDelayedFlag(loading && snapshot === null);
  const announcementsReadyRef = useRef(false);
  const previousMessageStateRef = useRef(new Map<string, { senderId: string; status: string | null }>());
  const [replyTarget, setReplyTarget] = useState<ChatMessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessageItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessageItem | null>(null);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(new Set());
  const [chatPreferences, setChatPreferences] = useState<ChatPreferences | null>(null);
  snapshotRef.current = snapshot;

  useEffect(() => {
    historicalEnd.current = undefined;
    followFocus.current = true;
    scrolledToMessage.current = '';
    scrollToLatest.current = false;
  }, [chatId, focusMessageId, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId || !chatId) return;
      const task = InteractionManager.runAfterInteractions(() => {
        void updateChatListPreferences(userId, chatId, { unread: false, deleted: false }).catch(() => {
          toast.showToast({ message: strings.organization.actionFailed });
        });
        void loadChatPreferences(userId, chatId).then(setChatPreferences).catch(() => setChatPreferences(null));
      });
      return () => task.cancel();
    }, [chatId, toast, userId]),
  );

  const accentColor = useMemo(
    () => CHAT_THEME_OPTIONS.find((option) => option.id === chatPreferences?.theme)?.color,
    [chatPreferences?.theme],
  );

  const scrollToFocusedMessage = useCallback(() => {
    if (!followFocus.current || !focusMessageId || scrolledToMessage.current === focusMessageId) return;
    const index = snapshotRef.current?.messages.findIndex((message) => message.messageId === focusMessageId) ?? -1;
    if (index < 0 || !listRef.current) return;
    scrolledToMessage.current = focusMessageId;
    listRef.current.scrollToIndex({ index, animated: false, viewPosition: 0.45 });
  }, [focusMessageId]);

  useEffect(() => {
    if (!userId) {
      const resetFrame = requestAnimationFrame(() => setPinnedMessageIds(new Set()));
      return () => cancelAnimationFrame(resetFrame);
    }
    let cancelled = false;
    void loadPinnedMessageIds(userId).then((ids) => {
      if (!cancelled) setPinnedMessageIds(ids);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [userId]);

  const togglePin = useCallback(async (messageId: string) => {
    const next = new Set(pinnedMessageIds);
    const wasPinned = next.delete(messageId);
    if (!wasPinned) next.add(messageId);
    const result = await performToastAction(toast.showToast, `${userId}:message-pins`, wasPinned ? 'unpinMessage' : 'pinMessage', async () => {
      await savePinnedMessageIds(userId, next);
      return next;
    });
    if (result.ok) setPinnedMessageIds(result.value);
  }, [pinnedMessageIds, toast, userId]);

  useEffect(() => {
    if (!snapshot || !userId) return;
    const next = new Map<string, { senderId: string; status: string | null }>();
    if (!announcementsReadyRef.current) {
      for (const message of snapshot.messages) {
        next.set(message.messageId, { senderId: message.senderId, status: message.pending?.status ?? null });
      }
      previousMessageStateRef.current = next;
      announcementsReadyRef.current = true;
      return;
    }

    for (const message of snapshot.messages) {
      const previous = previousMessageStateRef.current.get(message.messageId);
      const status = message.pending?.status ?? null;
      if (!previous && message.senderId !== userId) {
        const sender = message.senderName || strings.chatList.unknownMember;
        const content = message.content.trim() || strings.chat.attachmentOnly;
        AccessibilityInfo.announceForAccessibility(`${sender}: ${content}`);
      } else if (message.senderId === userId && previous?.status !== 'failed' && status === 'failed') {
        AccessibilityInfo.announceForAccessibility(strings.chat.messageFailedAnnouncement);
      }
      next.set(message.messageId, { senderId: message.senderId, status });
    }
    previousMessageStateRef.current = next;
  }, [snapshot, userId]);

  const refreshLatest = useCallback(async (showSpinner = false): Promise<void> => {
    if (!chatId || !userId) return;
    if (showSpinner) setRefreshing(true);
    const following = followFocus.current;
    try {
      const db = await getLocalDatabase();
      const beforeSeq = following ? historicalEnd.current : undefined;
      const initialFocus = following && focusMessageId && beforeSeq === undefined && scrolledToMessage.current !== focusMessageId;
      const result = initialFocus
        ? await loadChatSnapshotForMessage(db, chatId, userId, focusMessageId, config.list.pageSize)
        : { snapshot: await loadChatSnapshot(db, chatId, userId, { limit: config.list.pageSize, beforeSeq }), beforeSeq };
      if (followFocus.current !== following) return;
      const changeWindow = historicalEnd.current !== result.beforeSeq || scrollToLatest.current;
      historicalEnd.current = result.beforeSeq;
      setViewingHistory(result.beforeSeq !== undefined);
      setSnapshot((current) => current && !changeWindow ? mergeChatSnapshots(current, result.snapshot) : result.snapshot);
      setError(null);
      setLoading(false);
    } catch {
      if (followFocus.current !== following) return;
      scrollToLatest.current = false;
      setLoading(false);
      setError(strings.common.couldNotLoad);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, [chatId, focusMessageId, userId]);

  const jumpToLatest = useCallback(async () => {
    followFocus.current = false;
    scrollToLatest.current = true;
    await refreshLatest();
  }, [refreshLatest]);

  useEffect(() => {
    if (!snapshot || !scrollToLatest.current) return;
    const frame = requestAnimationFrame(() => {
      scrollToLatest.current = false;
      listRef.current?.scrollToEnd({ animated: !theme.reduceMotion });
    });
    return () => cancelAnimationFrame(frame);
  }, [snapshot, theme.reduceMotion]);

  const sendReadHint = useCallback(async (targetChatId: string, seq: number): Promise<boolean> => {
    if (targetChatId !== chatId) return false;
    return (await realtimeRef.current?.sendRead({ user_id: userId, last_read_seq: seq })) ?? false;
  }, [chatId, userId]);

  const sendReadState: ReadStateSender = useCallback(
    (targetChatId, seq) => updateOwnMember(supabase, targetChatId, userId, { last_read_seq: seq }),
    [userId],
  );

  const markRead = useCallback(async (nextSnapshot: ChatScreenSnapshot): Promise<void> => {
    const seq = maxDeliveredSeq(nextSnapshot.messages);
    if (!seq || !userId) return;
    const db = await getLocalDatabase();
    await markChatRead(db, chatId, userId, seq, net.isConnected, sendReadState, sendReadHint);
  }, [chatId, net.isConnected, sendReadHint, sendReadState, userId]);

  const updateTyping = useCallback((typingUserId: string, active: boolean) => {
    if (typingUserId === userId) return;
    setTyping((current) => {
      const next = new Map(current);
      const oldTimer = typingTimersRef.current.get(typingUserId);
      if (oldTimer) clearTimeout(oldTimer);
      if (!active) {
        next.delete(typingUserId);
        typingTimersRef.current.delete(typingUserId);
        return next;
      }
      const timer = setTimeout(() => {
        setTyping((latest) => {
          const cleared = new Map(latest);
          cleared.delete(typingUserId);
          return cleared;
        });
        typingTimersRef.current.delete(typingUserId);
      }, config.typing.hideAfterMs);
      typingTimersRef.current.set(typingUserId, timer);
      next.set(typingUserId, {
        name: snapshotRef.current?.messages.find((message) => message.senderId === typingUserId)?.senderName ?? strings.chatList.unknownMember,
        expiresAt: Date.now() + config.typing.hideAfterMs,
      });
      return next;
    });
  }, [userId]);

  useEffect(() => {
    // Let the native stack finish the route transition before the first cache
    // result can mount a potentially large message list. The loading surface is
    // already rendered, so this keeps the transition responsive without hiding
    // cached data once it is ready.
    const initialLoad = InteractionManager.runAfterInteractions(() => void refreshLatest());
    const unsubscribeCache = subscribeCacheChange(() => void refreshLatest());
    const unsubscribeQueue = subscribeQueueChange(() => void refreshLatest());
    return () => {
      initialLoad.cancel();
      unsubscribeCache();
      unsubscribeQueue();
    };
  }, [refreshLatest]);

  useEffect(() => {
    if (!snapshot || !userId) return;
    const readTask = setTimeout(() => void markRead(snapshot).catch(() => undefined), 0);
    return () => clearTimeout(readTask);
  }, [markRead, snapshot, userId]);

  useEffect(() => {
    if (!chatId || !userId) return;
    const handle = startChatRealtime(chatId, {
      onTyping: (payload) => updateTyping(payload.user_id, payload.active),
      onRead: (payload) => {
        if (payload.user_id === userId) return;
        void getLocalDatabase()
          .then((db) => listChatMembers(supabase, chatId).then(async (result) => {
            if (!result.error && result.data) {
              await cacheMembers(db, result.data);
              await refreshLatest();
            }
          }))
          .catch(() => undefined);
      },
    });
    realtimeRef.current = handle;
    return () => {
      handle.stop();
      realtimeRef.current = null;
    };
  }, [chatId, refreshLatest, updateTyping, userId]);

  useEffect(() => {
    if (!net.isConnected || !userId) return;
    void getLocalDatabase()
      .then((db) => flushPendingReadStates(db, sendReadState, sendReadHint))
      .catch(() => undefined);
  }, [net.isConnected, sendReadHint, sendReadState, userId]);

  useEffect(() => () => {
    for (const timer of typingTimersRef.current.values()) clearTimeout(timer);
    typingTimersRef.current.clear();
  }, []);

  const typingLabel = useMemo(() => {
    const active = [...typing.values()];
    if (active.length === 0) return snapshot?.subtitle ?? '';
    if (snapshot?.chat.type === 'group') {
      return active.length === 1 ? strings.chat.typingOne(active[0]?.name ?? strings.chatList.unknownMember) : strings.chat.typingMany(active.length);
    }
    return 'typing...';
  }, [snapshot, typing]);

  const loadOlder = useCallback(async () => {
    if (!snapshot || loadingOlder || !snapshot.hasMoreBefore) return;
    const oldest = snapshot.messages.find((message) => message.seq !== null)?.seq;
    if (oldest === undefined || oldest === null) return;
    const beforeSeq = historicalEnd.current;
    setLoadingOlder(true);
    try {
      const db = await getLocalDatabase();
      const older = await loadChatSnapshot(db, chatId, userId, { beforeSeq: oldest, limit: config.list.pageSize });
      if (historicalEnd.current !== beforeSeq) return;
      setSnapshot((current) => current ? {
        ...mergeChatSnapshots(older, current),
        hasMoreBefore: older.hasMoreBefore,
      } : current);
    } catch {
      toast.showToast({ message: strings.common.couldNotLoad });
    } finally {
      setLoadingOlder(false);
    }
  }, [chatId, loadingOlder, snapshot, toast, userId]);

  const pickMedia = async (kind: PickerKind) => {
    if (pickLock.current || sendLock.current) return;
    pickLock.current = true;
    setAttachMenu(false);
    setMediaBusy(true);
    try {
      const picked = await pickAttachments(kind, remainingAttachments(attachments.length));
      setAttachments((current) => [...current, ...picked.attachments].slice(0, config.media.maxAttachments));
      for (const message of picked.errors) toast.showToast({ message });
    } finally { pickLock.current = false; setMediaBusy(false); }
  };

  const openMediaPicker = useCallback(() => {
    if (mediaBusy || editingMessage) return;
    Keyboard.dismiss();
    setAttachMenu(false);
    setMediaPickerVisible((current) => !current);
  }, [editingMessage, mediaBusy]);

  const showMediaPickerError = useCallback((message: string) => {
    toast.showToast({ message });
  }, [toast]);

  const addMediaLibraryAssets = useCallback(async (assets: MediaLibraryAsset[]) => {
    setMediaPickerVisible(false);
    setMediaBusy(true);
    try {
      const picked = await Promise.all(assets.map((asset) => draftFromMediaLibraryAsset(asset)));
      const valid = picked.flatMap((result) => result.attachment ? [result.attachment] : []);
      setAttachments((current) => [...current, ...valid].slice(0, config.media.maxAttachments));
      for (const result of picked) if (result.error) toast.showToast({ message: result.error });
    } finally {
      setMediaBusy(false);
    }
  }, [toast]);

  const send = useCallback(async () => {
    const content = dgTrim(draft);
    if (sendLock.current || pickLock.current || !validateMessageText(draft, attachments.length).ok) return;
    sendLock.current = true;
    setMediaBusy(true);
    try {
      const input = { chatId, senderId: userId, content, replyTo: replyTarget?.messageId ?? null };
      const result = attachments.length > 0 ? await enqueueAttachmentMessage({ ...input, attachments }) : await enqueueTextMessage(input);
      if (!result.ok) {
        toast.showToast({ message: result.reason === 'queueFull' ? strings.queue.full : strings.media.queueFailed });
        return;
      }
      setDraft('');
      setAttachments([]);
      setReplyTarget(null);
    } catch {
      toast.showToast({ message: strings.media.queueFailed });
      return;
    } finally { sendLock.current = false; setMediaBusy(false); }
    await realtimeRef.current?.sendTyping({ user_id: userId, active: false });
    setTyping((current) => {
      const next = new Map(current);
      next.delete(userId);
      return next;
    });
    if (historicalEnd.current !== undefined) {
      await jumpToLatest();
    } else {
      await refreshLatest();
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [attachments, chatId, draft, jumpToLatest, refreshLatest, replyTarget, toast, userId]);

  const saveEdit = useCallback(async () => {
    if (!editingMessage) return;
    if (!net.isConnected) {
      toast.showToast({ ...actionToast('editMessage', 'error'), message: strings.common.checkConnection });
      return;
    }
    const content = dgTrim(draft);
    const validation = validateMessageText(draft, 0);
    if (!validation.ok) {
      const message = validation.reason === 'tooLong'
        ? strings.chat.messageTooLong(config.message.maxChars, Array.from(draft).length - config.message.maxChars)
        : strings.chat.deleteContentRequired;
      toast.showToast({ message, variant: 'error', placement: 'top' });
      return;
    }
    const outcome = await performToastAction(toast.showToast, `${userId}:edit:${editingMessage.messageId}`, 'editMessage', async () => {
      const result = await editMessage(supabase, editingMessage.messageId, content);
      if (result.error || !result.data) throw new Error('edit failed');
      // Refresh failures after confirmation must not produce a contradictory result.
      try {
        const db = await getLocalDatabase();
        await createSqliteCacheStore(db).upsertMessage(result.data);
        notifyCacheChange();
      } catch { /* The sync engine will reconcile the confirmed row. */ }
    });
    if (outcome.ok) {
      setEditingMessage((current) => current?.messageId === editingMessage.messageId ? null : current);
      setDraft((current) => current === draft ? '' : current);
      await refreshLatest().catch(() => undefined);
    }
  }, [draft, editingMessage, net.isConnected, refreshLatest, toast, userId]);

  const persistReaction = useCallback(async (reaction: Awaited<ReturnType<typeof addReaction>>['data']): Promise<void> => {
    if (!reaction) return;
    const db = await getLocalDatabase();
    await createSqliteCacheStore(db).upsertReaction(reaction);
    notifyCacheChange();
    await refreshLatest();
  }, [refreshLatest]);

  const toggleReaction = useCallback(async (item: ChatMessageItem, emoji: string) => {
    if (!net.isConnected) {
      toast.showToast({ message: strings.common.noConnection });
      return;
    }
    if (item.deletedAt !== null || item.pending) return;
    const ownReaction = item.reactions.find((reaction) => reaction.user_id === userId && reaction.emoji === emoji);
    if (!ownReaction && item.reactions.filter((reaction) => reaction.user_id === userId).length >= config.reactions.maxActivePerMessage) {
      toast.showToast({ message: strings.chat.reactionLimit });
      return;
    }
    const db = await getLocalDatabase();
    const result = ownReaction
      ? await setReactionRemoved(supabase, item.messageId, userId, emoji, true)
      : (await loadCachedReaction(db, item.messageId, userId, emoji))
        ? await setReactionRemoved(supabase, item.messageId, userId, emoji, false)
        : await addReaction(supabase, { message_id: item.messageId, user_id: userId, emoji });
    if (result.error || !result.data) {
      toast.showToast({ message: strings.common.couldNotLoad });
      return;
    }
    await persistReaction(result.data);
  }, [net.isConnected, persistReaction, toast, userId]);

  const copyMessage = useCallback(async (item: ChatMessageItem) => {
    if (!item.content) return;
    await performToastAction(toast.showToast, `${userId}:copy:${item.messageId}`, 'copyMessage', () => Clipboard.setStringAsync(item.content));
  }, [toast, userId]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    if (!net.isConnected) {
      toast.showToast({ ...actionToast('deleteMessage', 'error'), message: strings.common.checkConnection });
      return;
    }
    const outcome = await performToastAction(toast.showToast, `${userId}:delete:${deleteTarget.messageId}`, 'deleteMessage', async () => {
      const result = await softDeleteMessage(supabase, deleteTarget.messageId);
      if (result.error || !result.data) throw new Error('delete failed');
      try {
        const db = await getLocalDatabase();
        await createSqliteCacheStore(db).upsertMessage(result.data);
        notifyCacheChange();
      } catch { /* Reconciled by sync. */ }
    });
    if (outcome.ok) {
      setDeleteTarget(null);
      await refreshLatest().catch(() => undefined);
    }
  }, [deleteTarget, net.isConnected, refreshLatest, toast, userId]);

  const retry = useCallback(async (tempId: string) => {
    const result = await retryQueueItem(tempId);
    if (!result.ok) toast.showToast({ message: strings.common.couldNotLoad });
  }, [toast]);

  const discard = useCallback(async (tempId: string) => {
    const result = await discardQueueItem(tempId, net.isConnected);
    if (!result.ok) toast.showToast({ message: result.reason === 'offline' ? strings.common.noConnection : strings.common.couldNotLoad });
  }, [net.isConnected, toast]);

  const lastOwnMessageId = useMemo(() => {
    const own = snapshot?.messages.filter((message) => message.senderId === userId && message.pending === null) ?? [];
    return own[own.length - 1]?.messageId ?? null;
  }, [snapshot?.messages, userId]);

  const pinnedMessages = useMemo(
    () => snapshot?.messages.filter((message) => pinnedMessageIds.has(message.messageId) && message.deletedAt === null) ?? [],
    [pinnedMessageIds, snapshot?.messages],
  );
  const pinnedPreview = pinnedMessages[pinnedMessages.length - 1];
  const canStartVoiceCall = snapshot?.chat.type === 'direct'
    && (!call.currentCall || call.currentCall.chatId === chatId);

  const renderMessage: ListRenderItem<ChatMessageItem> = useCallback(({ item, index }) => {
    if (!snapshot) return null;
    const previous = snapshot.messages[index - 1];
    const isUnread = item.seq !== null && item.seq > snapshot.myLastReadSeq && item.senderId !== userId && item.deletedAt === null;
    const otherHasRead = snapshot.members.filter((member) => member.user_id !== userId).some((member) => item.seq !== null && member.last_read_seq >= item.seq);
    const status: BubbleStatus = item.pending ? null : item.messageId === lastOwnMessageId ? (otherHasRead ? 'seen' : 'sent') : null;
    const row = (
      <>
        {shouldSeparate(previous, item) ? <DateSeparator label={dateLabel(item.createdAt)} /> : null}
        {isUnread && (index === 0 || (snapshot.messages[index - 1]?.seq ?? 0) <= snapshot.myLastReadSeq) ? <UnreadDivider /> : null}
        <MessageBubble
          item={item}
          own={item.senderId === userId}
          userId={userId}
          pinned={pinnedMessageIds.has(item.messageId)}
          accentColor={accentColor}
          status={status}
          onAttachmentPress={(attachment) => router.push({ pathname: '/chat/[chatId]/media/[mediaId]', params: { chatId, mediaId: attachment.mediaId } })}
          lowSignalActive={item.pending ? isLowSignalActive(net, item.pending.force_low_signal) : false}
          showTime={showTimeId === item.messageId}
          onPress={() => setShowTimeId((current) => current === item.messageId ? null : item.messageId)}
          onLongPress={() => {
            if (item.deletedAt === null) setFocusMessage(item);
          }}
          onDoubleTap={() => {
            if (item.deletedAt === null) void toggleReaction(item, '❤️');
          }}
          onReactionPress={(emoji) => void toggleReaction(item, emoji)}
          reactionDisabled={!net.isConnected || item.deletedAt !== null}
          replyPreview={item.replyTo ? (() => {
            const parent = snapshot.messages.find((message) => message.messageId === item.replyTo);
            return parent ? { senderName: parent.senderName || strings.chatList.unknownMember, content: parent.content, deleted: parent.deletedAt !== null } : undefined;
          })() : undefined}
          onRetry={item.pending ? () => void retry(item.pending?.temp_id ?? '') : undefined}
          onDiscard={item.pending ? () => void discard(item.pending?.temp_id ?? '') : undefined}
          discardDisabled={!net.isConnected}
        />
      </>
    );
    return item.messageId === focusMessageId ? (
      <View
        onLayout={() => requestAnimationFrame(scrollToFocusedMessage)}
        style={{ backgroundColor: theme.colors.bg.pressed }}
      >
        {row}
      </View>
    ) : row;
  }, [accentColor, chatId, discard, focusMessageId, lastOwnMessageId, net, pinnedMessageIds, retry, router, scrollToFocusedMessage, showTimeId, snapshot, theme.colors.bg.pressed, toggleReaction, userId]);

  if (!chatId || !userId) {
    return <EmptyState iconName="action.info" title={strings.chatInfo.unavailable} message={strings.chatInfo.unavailableBody} />;
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.colors.bg.chat }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TopBar
        title={snapshot?.title ?? 'Chat'}
        subtitle={typingLabel}
        onBack={() => goBackOrReplace(router)}
          right={(
            <View style={styles.topActions}>
              {snapshot?.chat.type === 'direct' ? (
                <IconButton
                  iconName="action.phone"
                  accessibilityLabel={strings.calls.startVoice}
                  disabled={!canStartVoiceCall}
                  onPress={() => {
                    if (!net.isConnected) {
                      toast.showToast({ message: strings.calls.offline });
                      return;
                    }
                    void call.startVoiceCall(chatId);
                  }}
                />
              ) : null}
              <IconButton iconName="action.info" accessibilityLabel="Chat info" onPress={() => router.push({ pathname: '/chat/[chatId]/info', params: { chatId } })} />
            </View>
          )}
      />
      {call.view.error && !call.view.callId ? <Text style={[styles.callError, { color: theme.colors.error.text }]} accessibilityRole="alert">{call.view.error}</Text> : null}
      {pinnedMessages.length > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.pinnedBanner, { backgroundColor: theme.colors.bg.surface, borderBottomColor: theme.colors.separator, opacity: pressed ? 0.82 : 1 }]}
          onPress={() => router.push({ pathname: '/chat/[chatId]/pinned', params: { chatId } })}
          accessibilityRole="button"
          accessibilityLabel={`${strings.chatInfo.pinnedMessages}, ${pinnedPreview?.content || strings.chat.attachmentOnly}`}
        >
          <View style={[styles.pinnedBannerIcon, { backgroundColor: theme.colors.bg.pressed }]}>
            <Icon name="action.pin" size="sm" color={theme.colors.brand.primary} accessibilityLabel="" />
          </View>
          <View style={styles.pinnedBannerCopy}>
            <Text style={[styles.pinnedBannerTitle, { color: theme.colors.text.primary }]} numberOfLines={1}>{strings.chatInfo.pinnedMessages}</Text>
            <Text style={[styles.pinnedBannerPreview, { color: theme.colors.text.secondary }]} numberOfLines={1}>{pinnedPreview?.content || strings.chat.attachmentOnly}</Text>
          </View>
          <Icon name="nav.forward" size="sm" color={theme.colors.text.muted} accessibilityLabel="" />
        </Pressable>
      ) : null}
      {!net.isConnected ? <OfflineBanner /> : null}
      {loading && snapshot === null ? (
        <View style={styles.center} accessibilityLabel="Loading messages">{showLoading ? <ActivityIndicator color={theme.colors.brand.primary} /> : null}</View>
      ) : error && !snapshot ? (
        <View style={styles.center}>
          <Text style={[styles.error, { color: theme.colors.error.text }]}>{error}</Text>
          <Button label={strings.common.retry} variant="text" onPress={() => void refreshLatest(true)} />
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={snapshot?.messages ?? []}
            renderItem={renderMessage}
            keyExtractor={(item) => item.messageId}
            initialNumToRender={focusMessageId ? config.list.pageSize : undefined}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
            }}
            contentContainerStyle={styles.listContent}
            onScroll={(event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              setAtBottom(contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80);
              if (contentOffset.y < 80) void loadOlder();
            }}
            scrollEventThrottle={100}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshLatest(true)} tintColor={theme.colors.brand.primary} />}
            ListEmptyComponent={
              <EmptyState
                imageSource={require('../../../assets/logo/dologram_logo.png')}
                title={strings.chat.emptyTitle}
                message="Send the first message."
              />
            }
            accessibilityLabel="Messages"
          />
          {viewingHistory ? (
            <Button label="Jump to latest messages" variant="text" onPress={() => void jumpToLatest()} />
          ) : snapshot && !atBottom ? <View style={styles.jump}><JumpToBottom onPress={() => listRef.current?.scrollToEnd({ animated: true })} unreadCount={snapshot.unreadCount} /></View> : null}
          <DelayedActivityIndicator active={loadingOlder} style={styles.olderSpinner} color={theme.colors.brand.primary} />
          <ChatComposer
            value={draft}
            sending={mediaBusy}
            attachments={attachments}
            onRemoveAttachment={(id) => setAttachments((current) => current.filter((attachment) => attachment.id !== id))}
            onCamera={() => setAttachMenu(true)}
            onGallery={openMediaPicker}
            galleryActive={mediaPickerVisible}
            onMessageFocus={() => setMediaPickerVisible(false)}
            onAttach={() => setAttachMenu(true)}
            onRecorded={(attachment) => setAttachments((current) => [...current, attachment].slice(0, config.media.maxAttachments))}
            onMediaError={(message) => toast.showToast({ message })}
            onChangeText={(value) => {
              setDraft(value);
              if (net.isConnected && Date.now() - lastTypingSentRef.current >= config.typing.sendEveryMs) {
                lastTypingSentRef.current = Date.now();
                void realtimeRef.current?.sendTyping({ user_id: userId, active: true });
              }
            }}
            onSend={() => void (editingMessage ? saveEdit() : send())}
            editing={editingMessage !== null}
            replyPreview={replyTarget ? { senderName: replyTarget.senderName || strings.chatList.unknownMember, content: replyTarget.content, deleted: replyTarget.deletedAt !== null } : undefined}
            onCancelMode={() => {
              setReplyTarget(null);
              setEditingMessage(null);
              setDraft('');
            }}
          />
          <MediaPickerPanel
            visible={mediaPickerVisible}
            maxSelection={remainingAttachments(attachments.length)}
            onClose={() => setMediaPickerVisible(false)}
            onDone={(assets) => void addMediaLibraryAssets(assets)}
            onError={showMediaPickerError}
          />
        </>
      )}
      <BottomSheet visible={attachMenu} onClose={() => setAttachMenu(false)}>
        <View style={{ padding: theme.space[4], gap: theme.space[2] }}>
          <Button label={strings.media.cameraPhoto} onPress={() => void pickMedia('photo')} />
          <Button label={strings.media.cameraVideo} onPress={() => void pickMedia('video')} />
          <Button label={strings.media.gallery} onPress={openMediaPicker} />
          <Button label={strings.media.file} onPress={() => void pickMedia('file')} />
        </View>
      </BottomSheet>
      <MessageFocusOverlay
        visible={focusMessage !== null}
        item={focusMessage}
        own={focusMessage?.senderId === userId}
        userId={userId}
        online={net.isConnected}
        discardDisabled={!net.isConnected}
        onClose={() => setFocusMessage(null)}
        onReact={(emoji) => {
          if (focusMessage) void toggleReaction(focusMessage, emoji);
          setFocusMessage(null);
        }}
        onReply={() => {
          if (focusMessage) setReplyTarget(focusMessage);
          setEditingMessage(null);
          setDraft('');
          setFocusMessage(null);
        }}
        onForward={() => {
          if (focusMessage) router.push({ pathname: '/forward', params: { sourceChatId: chatId, messageId: focusMessage.messageId } });
          setFocusMessage(null);
        }}
        onCopy={() => {
          if (focusMessage) void copyMessage(focusMessage);
          setFocusMessage(null);
        }}
        onEdit={() => {
          if (focusMessage) {
            setEditingMessage(focusMessage);
            setReplyTarget(null);
            setDraft(focusMessage.content);
          }
          setFocusMessage(null);
        }}
        onDelete={() => {
          if (focusMessage) setDeleteTarget(focusMessage);
          setFocusMessage(null);
        }}
        onRetry={() => {
          if (focusMessage?.pending) void retry(focusMessage.pending.temp_id);
          setFocusMessage(null);
        }}
        onDiscard={() => {
          if (focusMessage?.pending) void discard(focusMessage.pending.temp_id);
          setFocusMessage(null);
        }}
        pinned={focusMessage ? pinnedMessageIds.has(focusMessage.messageId) : false}
        onPin={() => {
          if (focusMessage) void togglePin(focusMessage.messageId);
          setFocusMessage(null);
        }}
      />
      <Dialog
        visible={deleteTarget !== null}
        title={strings.chat.deleteConfirm}
        confirmLabel={strings.chat.delete}
        onConfirm={() => void confirmDelete()}
        onDismiss={() => setDeleteTarget(null)}
        destructive
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topActions: { flexDirection: 'row', alignItems: 'center' },
  callError: { paddingHorizontal: 16, paddingVertical: 8, textAlign: 'center', fontSize: 13 },
  container: { flex: 1 },
  listContent: { paddingVertical: 12, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  error: { textAlign: 'center', fontSize: 16 },
  jump: { position: 'absolute', right: 16, bottom: 76 },
  olderSpinner: { position: 'absolute', top: 68, alignSelf: 'center' },
  pinnedBanner: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  pinnedBannerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pinnedBannerCopy: { flex: 1, gap: 2 },
  pinnedBannerTitle: { fontSize: 14, fontWeight: '700' },
  pinnedBannerPreview: { fontSize: 14 },
});
