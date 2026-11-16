/** Messenger-style Chat Info / Conversation Details screen. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import {
  insertMember,
  maxSelectableMembers,
  mutedUntil,
  removeMember,
  strings,
  toggleContactSelection,
  updateChatAvatar,
  updateOwnMember,
  type ChatInfoMember,
  type MuteOptionId,
} from '@dologram/shared';
import { TopBar } from '../../../src/components/TopBar';
import { goBackOrReplace } from '../../../src/navigation/goBackOrReplace';
import { Avatar } from '../../../src/components/Avatar';
import { Button, IconButton } from '../../../src/components/Button';
import { ChatActionsPopover } from '../../../src/components/ChatActionsPopover';
import { ContactRow } from '../../../src/components/ContactRow';
import { Dialog } from '../../../src/components/Dialog';
import { EmptyState, ErrorState } from '../../../src/components/EmptyState';
import { MemberRow } from '../../../src/components/MemberRow';
import { SkeletonRow } from '../../../src/components/Skeleton';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { Icon } from '../../../src/components/Icon';
import { MuteOptionGrid } from '../../../src/components/MuteOptionGrid';
import { actionToast, type ToastAction, type ToastDetails } from '../../../src/notifications/toastCopy';
import { useToast } from '../../../src/components/Toast';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { textStyle } from '../../../src/theme/typography';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useNetState } from '../../../src/net/netState';
import { supabase } from '../../../src/lib/supabase';
import { getLocalDatabase } from '../../../src/queue/db';
import { createSqliteCacheStore } from '../../../src/sync/cacheStore';
import { useChatInfo } from '../../../src/chats/useChatInfo';
import { useContacts } from '../../../src/chats/useContacts';
import { mutationErrorMessage } from '../../../src/chats/errors';
import { removeCachedMembership } from '../../../src/sync/localCache';
import { notifyCacheChange } from '../../../src/sync/cacheEvents';
import { resyncNow } from '../../../src/sync/lifecycle';
import { deleteChatFromDevice } from '../../../src/chatList/deleteChat';
import { loadChatListPreferences, setChatListPreference } from '../../../src/chatList/preferences';
import { useDelayedFlag } from '../../../src/hooks/useDelayedFlag';
import { cacheMember } from '../../../src/chat/readState';
import { loadChatSnapshot, type ChatMessageItem } from '../../../src/chat/query';
import { useCall } from '../../../src/calls/useCall';
import { attachmentLabel } from '../../../src/media/model';
import {
  clearChatPreferences,
  loadChatPreferences,
  updateChatPreferences,
  type ChatPreferences,
} from '../../../src/chats/preferences';

const SKELETON_ROWS = 4;

type QuickActionProps = {
  iconName: string;
  label: string;
  disabled?: boolean;
  width?: number;
  onPress: () => void;
};

function QuickAction({ iconName, label, disabled = false, width, onPress }: QuickActionProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.quickAction,
        width ? { width, flex: 0 } : undefined,
        { backgroundColor: pressed && !disabled ? c.bg.pressed : 'transparent', opacity: disabled ? 0.5 : 1 },
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <View style={[styles.quickIcon, { backgroundColor: c.bg.surface }]}>
        <Icon name={iconName} size="md" color={c.text.primary} accessibilityLabel="" />
      </View>
      <Text style={[textStyle(theme.typeTokens.labelMd), styles.quickLabel, { color: c.text.primary }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function MenuItem({ iconName, label, destructive = false, onPress }: { iconName: string; label: string; destructive?: boolean; onPress: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: c.bg.pressed }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={iconName} size="md" color={destructive ? c.error.text : c.text.primary} accessibilityLabel="" />
      <Text style={[textStyle(theme.typeTokens.bodyLg), { color: destructive ? c.error.text : c.text.primary }]}>{label}</Text>
    </Pressable>
  );
}

function HorizontalSection({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.horizontalSection, { borderTopColor: c.separator }]}>
      <Text style={[textStyle(theme.typeTokens.titleSm), styles.sectionTitle, { color: c.text.secondary }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
        {children}
      </ScrollView>
    </View>
  );
}

function SharedEmpty() {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.sharedEmpty}>
      <Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.primary }]}>{strings.chatInfo.noSharedContent}</Text>
      <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>{strings.chatInfo.noSharedContentBody}</Text>
    </View>
  );
}

type InfoRowProps = {
  iconName: string;
  label: string;
  detail?: string;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

function InfoRow({ iconName, label, detail, onPress, disabled = false, destructive = false }: InfoRowProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.infoRow,
        { opacity: disabled ? 0.5 : 1 },
        pressed && !disabled ? { backgroundColor: c.bg.pressed } : undefined,
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || !onPress }}
    >
      <View style={[styles.rowIcon, { backgroundColor: destructive ? c.error.bg : c.bg.surface }]}>
        <Icon name={iconName} size="md" color={destructive ? c.error.text : c.text.primary} accessibilityLabel="" />
      </View>
      <View style={styles.rowText}>
        <Text style={[textStyle(theme.typeTokens.bodyLg), { color: destructive ? c.error.text : c.text.primary }]}>{label}</Text>
        {detail ? <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>{detail}</Text> : null}
      </View>
      {onPress ? <Icon name="nav.forward" size="sm" color={c.text.muted} accessibilityLabel="" /> : null}
    </Pressable>
  );
}

export default function ChatInfoScreen() {
  const { chatId, action } = useLocalSearchParams<{ chatId: string; action?: string }>();
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const net = useNetState();
  const { session } = useAuth();
  const { showToast } = useToast();
  const { startVoiceCall, startVideoCall } = useCall();
  const userId = session?.user.id ?? null;
  const { loading, error, info, reload, refresh, applyMember } = useChatInfo(chatId);
  const showLoading = useDelayedFlag(loading);
  const memberIds = useMemo(() => info?.members.map((member) => member.userId) ?? [], [info]);
  const { contacts } = useContacts(memberIds);
  const [preferences, setPreferences] = useState<ChatPreferences | null>(null);
  const [starred, setStarred] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [addSelected, setAddSelected] = useState<readonly string[]>([]);
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ChatInfoMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [leaveVisible, setLeaveVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [organizationBusy, setOrganizationBusy] = useState(false);
  const [muteVisible, setMuteVisible] = useState(false);
  const [blockVisible, setBlockVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [destructiveBusy, setDestructiveBusy] = useState(false);
  const [avatarSheetVisible, setAvatarSheetVisible] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [signedAvatarUrl, setSignedAvatarUrl] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeSharedTab, setActiveSharedTab] = useState<'media' | 'files' | 'links'>('media');
  const [sharedMessages, setSharedMessages] = useState<ChatMessageItem[]>([]);
  const [sharedLoading, setSharedLoading] = useState(true);
  const handledAddAction = useRef(false);
  const mutationLock = useRef(false);
  useEffect(() => {
    if (action === 'add-members' && info?.canAddMembers && !handledAddAction.current) {
      handledAddAction.current = true;
      setAddSelected([]);
      setAddVisible(true);
    }
  }, [action, info?.canAddMembers]);

  const offline = !net.isConnected;
  // Nicknames are shared member labels. The legacy device-only preference is intentionally not
  // used for the title, so an old local value cannot mask the conversation's shared state.
  const shownTitle = info?.title || 'Chat';
  const canCall = Boolean(net.isConnected && info && !info.isGroup && !info.savedMessages);

  useEffect(() => {
    if (!chatId || !userId) return;
    let active = true;
    setSharedLoading(true);
    void getLocalDatabase().then((db) => loadChatSnapshot(db, chatId, userId, { limit: 200 })).then((snapshot) => {
      if (active) setSharedMessages(snapshot.messages.filter((message) => message.deletedAt === null));
    }).catch(() => {
      if (active) setSharedMessages([]);
    }).finally(() => {
      if (active) setSharedLoading(false);
    });
    return () => { active = false; };
  }, [chatId, userId]);

  const sharedEntries = useMemo(() => sharedMessages.flatMap((message) => message.attachments.map((attachment) => ({ attachment, message }))), [sharedMessages]);
  const sharedMedia = useMemo(() => sharedEntries.filter(({ attachment }) => attachment.mediaType === 'photo' || attachment.mediaType === 'video'), [sharedEntries]);
  const sharedFiles = useMemo(() => sharedEntries.filter(({ attachment }) => attachment.mediaType === 'file'), [sharedEntries]);
  const sharedLinks = useMemo(() => sharedMessages.flatMap((message) => {
    const urls = message.content.match(/https?:\/\/[^\s)]+/g) ?? [];
    return urls.map((url) => ({ message, url }));
  }), [sharedMessages]);

  useEffect(() => {
    let active = true;
    const storagePath = info?.isGroup ? info.avatarUrl : null;
    if (!storagePath) {
      setSignedAvatarUrl(null);
      return () => { active = false; };
    }
    if (storagePath.startsWith('http')) {
      setSignedAvatarUrl(storagePath);
      return () => { active = false; };
    }
    void supabase.storage.from('chat-avatars').createSignedUrl(storagePath, 60 * 60).then(({ data }) => {
      if (active) setSignedAvatarUrl(data?.signedUrl ?? null);
    }).catch(() => {
      if (active) setSignedAvatarUrl(null);
    });
    return () => { active = false; };
  }, [info?.avatarUrl, info?.isGroup]);

  const handleGroupAvatarPick = useCallback(async (source: 'camera' | 'library') => {
    if (!chatId || !info?.isGroup || !info.isOwner || avatarUploading || !net.isConnected) return;
    setAvatarSheetVisible(false);
    setAvatarUploading(true);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showToast({ message: strings.profile.permissionDenied });
          return;
        }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const converted = await ImageManipulator.manipulateAsync(
        asset.uri,
        [],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 },
      );
      const file = new File(converted.uri);
      try {
        const storagePath = `${chatId}/avatar`;
        const { error: uploadError } = await supabase.storage.from('chat-avatars').upload(storagePath, await file.arrayBuffer(), {
          cacheControl: '3600',
          contentType: 'image/jpeg',
          upsert: true,
        });
        if (uploadError) throw uploadError;
        const updated = await updateChatAvatar(supabase, chatId, storagePath);
        if (updated.error || !updated.data) throw new Error('group_avatar_update_failed');
        await createSqliteCacheStore(await getLocalDatabase()).upsertChat(updated.data);
        notifyCacheChange();
        const signed = await supabase.storage.from('chat-avatars').createSignedUrl(storagePath, 60 * 60);
        setSignedAvatarUrl(signed.data?.signedUrl ?? null);
        showToast({ message: strings.chatInfo.pictureSaved });
      } finally {
        if (converted.uri !== asset.uri && file.exists) file.delete();
      }
    } catch {
      showToast({ message: strings.chatInfo.pictureFailed, variant: 'error' });
    } finally {
      setAvatarUploading(false);
    }
  }, [avatarUploading, chatId, info?.isGroup, info?.isOwner, net.isConnected, showToast]);

  useFocusEffect(
    useCallback(() => {
      if (!userId || !chatId) return;
      void loadChatPreferences(userId, chatId).then(setPreferences).catch(() => setPreferences(null));
    void loadChatListPreferences(userId)
      .then((next) => setStarred(next.pinned.includes(chatId)))
      .catch(() => setStarred(false));
    }, [chatId, userId]),
  );

  const openAddMembers = useCallback(() => {
    setAddSelected([]);
    setAddVisible(true);
  }, []);

  const onToggleAdd = useCallback((memberId: string) => {
    setAddSelected((current) => toggleContactSelection(current, memberId, maxSelectableMembers));
  }, []);

  const refreshAfterChange = useCallback(async () => {
    await resyncNow();
    await reload();
  }, [reload]);

  const onAddMembers = useCallback(async () => {
    if (!chatId || addSelected.length === 0 || adding || offline || mutationLock.current) return;
    mutationLock.current = true;
    setAdding(true);
    const failedIds: string[] = [];
    try {
      for (const memberId of addSelected) {
        try {
          const inserted = await insertMember(supabase, { chat_id: chatId, user_id: memberId, role: 'member' });
          if (inserted.error) failedIds.push(memberId);
        } catch { failedIds.push(memberId); }
      }
      const added = addSelected.length - failedIds.length;
      setAddSelected(failedIds);
      if (failedIds.length === 0) setAddVisible(false);
      showToast({ message: strings.toasts.membersAdded(added, failedIds.length), variant: failedIds.length ? 'error' : 'success', placement: 'bottom' });
      await refreshAfterChange().catch(() => undefined);
    } finally {
      mutationLock.current = false;
      setAdding(false);
    }
  }, [addSelected, adding, chatId, offline, refreshAfterChange, showToast]);

  const onRemove = useCallback(async () => {
    if (!chatId || removeTarget === null || removing || mutationLock.current) return;
    mutationLock.current = true;
    setRemoving(true);
    try {
      const removed = await removeMember(supabase, chatId, removeTarget.userId);
      if (removed.error) {
        showToast(actionToast('removeMember', 'error'));
        return;
      }
      setRemoveTarget(null);
      showToast(actionToast('removeMember', 'success'));
      await refreshAfterChange().catch(() => undefined);
    } catch {
      showToast(actionToast('removeMember', 'error'));
    } finally {
      mutationLock.current = false;
      setRemoving(false);
    }
  }, [chatId, refreshAfterChange, removeTarget, removing, showToast]);

  const onLeave = useCallback(async () => {
    if (!chatId || !userId || leaving) return;
    setLeaving(true);
    try {
      const removed = await removeMember(supabase, chatId, userId);
      if (removed.error) {
        showToast({ message: mutationErrorMessage(removed.error, strings.chatInfo.leaveFailed) });
        return;
      }
      const db = await getLocalDatabase();
      await removeCachedMembership(db, chatId, userId);
      notifyCacheChange();
      setLeaveVisible(false);
      router.replace('/(main)/(tabs)');
    } catch {
      showToast({ message: strings.chatInfo.leaveFailed });
    } finally {
      setLeaving(false);
    }
  }, [chatId, leaving, router, showToast, userId]);

  const updateOrganization = useCallback(async (patch: Parameters<typeof updateOwnMember>[3], feedback?: ToastAction, details?: ToastDetails) => {
    if (!chatId || !userId || offline || organizationBusy || mutationLock.current) return;
    const action = feedback ?? (patch.archived !== undefined ? patch.archived ? 'archiveChat' : 'unarchiveChat' : patch.muted_until === null ? 'unmuteChat' : 'muteChat');
    mutationLock.current = true;
    setOrganizationBusy(true);
    try {
      const result = await updateOwnMember(supabase, chatId, userId, patch);
      if (result.error) {
        showToast(actionToast(action, 'error', details));
      } else {
        setMuteVisible(false);
        // Apply the confirmed member row locally before announcing success;
        // a full resync can take seconds and must not leave the opposite action.
        applyMember(result.data);
        try {
          await cacheMember(await getLocalDatabase(), result.data);
          await reload();
        } catch {
          // The server succeeded. Retain its state and reconcile later rather
          // than report a failed mutation and invite a duplicate action.
          void resyncNow().catch(() => undefined);
        }
        notifyCacheChange();
        showToast(actionToast(action, 'success', details));
      }
    } catch {
      showToast(actionToast(action, 'error', details));
    } finally {
      mutationLock.current = false;
      setOrganizationBusy(false);
    }
  }, [applyMember, chatId, offline, organizationBusy, reload, showToast, userId]);

  const selectMute = useCallback((option: MuteOptionId) => {
    void updateOrganization({ muted_until: mutedUntil(option, new Date()) }, 'muteChat', { mute: option });
  }, [updateOrganization]);

  const updatePreferences = useCallback(async (patch: Partial<ChatPreferences>): Promise<boolean> => {
    if (!userId || !chatId) return false;
    try {
      const next = await updateChatPreferences(userId, chatId, patch);
      setPreferences(next);
      return true;
    } catch {
      showToast({ message: strings.chatInfo.preferenceFailed });
      return false;
    }
  }, [chatId, showToast, userId]);

  const toggleStar = useCallback(async () => {
    if (!userId || !chatId || info?.savedMessages || mutationLock.current) return;
    mutationLock.current = true;
    const next = !starred;
    try {
      await setChatListPreference(userId, chatId, 'pinned', next);
      setStarred(next);
      showToast(actionToast(next ? 'starChat' : 'unstarChat', 'success'));
    } catch {
      showToast(actionToast(next ? 'starChat' : 'unstarChat', 'error'));
    } finally {
      mutationLock.current = false;
    }
  }, [chatId, info?.savedMessages, showToast, starred, userId]);

  const onBlock = useCallback(async () => {
    if (destructiveBusy || mutationLock.current) return;
    mutationLock.current = true;
    setDestructiveBusy(true);
    try {
      if (!(await updatePreferences({ blocked: true }))) return;
      notifyCacheChange();
      router.replace('/(main)/(tabs)');
    } catch {
      showToast({ message: strings.chatInfo.blockFailed });
    } finally {
      mutationLock.current = false;
      setDestructiveBusy(false);
      setBlockVisible(false);
    }
  }, [destructiveBusy, router, showToast, updatePreferences]);

  const onDelete = useCallback(async () => {
    if (destructiveBusy || mutationLock.current) return;
    mutationLock.current = true;
    setDestructiveBusy(true);
    try {
      if (!chatId || !userId) return;
      await deleteChatFromDevice(userId, chatId);
      await clearChatPreferences(userId, chatId).catch(() => undefined);
      showToast(actionToast('deleteChat', 'success'));
      setDeleteVisible(false);
      router.replace('/(main)/(tabs)');
    } catch {
      showToast(actionToast('deleteChat', 'error'));
    } finally {
      mutationLock.current = false;
      setDestructiveBusy(false);
    }
  }, [chatId, destructiveBusy, router, showToast, userId]);

  const startCall = useCallback((kind: 'voice' | 'video') => {
    if (!net.isConnected) {
      showToast({ message: strings.callsHistory.offline, variant: 'error' });
      return;
    }
    if (!chatId || !canCall) {
      showToast({ message: strings.callsHistory.unavailable, variant: 'error' });
      return;
    }
    void (kind === 'voice' ? startVoiceCall(chatId) : startVideoCall(chatId));
  }, [canCall, chatId, net.isConnected, showToast, startVideoCall, startVoiceCall]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar
        title={strings.chatInfo.title}
        onBack={() => goBackOrReplace(router, chatId ? { pathname: '/chat/[chatId]', params: { chatId } } : '/(main)/(tabs)')}
        right={(
          <IconButton
            iconName="nav.more"
            accessibilityLabel="More chat actions"
            accessibilityState={{ expanded: menuVisible }}
            onPress={() => setMenuVisible((visible) => !visible)}
          />
        )}
      />

      {info ? (
        <ChatActionsPopover visible={menuVisible} onClose={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            {!info.savedMessages ? <MenuItem iconName={starred ? 'action.starOff' : 'action.star'} label={strings.chatInfo.menuAddStarred} onPress={() => { setMenuVisible(false); void toggleStar(); }} /> : null}
            <MenuItem iconName={info.muted ? 'action.unmute' : 'action.mute'} label={strings.chatInfo.menuMute} onPress={() => { setMenuVisible(false); info.muted ? void updateOrganization({ muted_until: null }) : setMuteVisible(true); }} />
            {!info.isGroup && !info.savedMessages ? <MenuItem iconName="action.newGroup" label={strings.chatInfo.menuCreateGroup} onPress={() => { setMenuVisible(false); router.push({ pathname: '/new-group', params: { groupWith: info.avatarId } }); }} /> : null}
            {!info.isGroup && !info.savedMessages ? <MenuItem iconName="action.ignore" label={strings.chatInfo.menuBlock} onPress={() => { setMenuVisible(false); setBlockVisible(true); }} /> : null}
            <MenuItem iconName="action.delete" label={strings.chatInfo.menuDeleteChat} destructive onPress={() => { setMenuVisible(false); setDeleteVisible(true); }} />
          </View>
        </ChatActionsPopover>
      ) : null}

      <BottomSheet visible={avatarSheetVisible} onClose={() => setAvatarSheetVisible(false)}>
        <View style={[styles.avatarSheet, { padding: theme.space[4] }]}>
          <Text style={[textStyle(theme.typeTokens.titleSm), { color: c.text.primary }]}>{strings.chatInfo.changePicture}</Text>
          <Pressable
            onPress={() => void handleGroupAvatarPick('camera')}
            accessibilityRole="button"
            accessibilityLabel={strings.chatInfo.takePhoto}
            style={({ pressed }) => [styles.avatarSheetRow, pressed && { backgroundColor: c.bg.pressed }]}
          >
            <Icon name="action.camera" size="md" color={c.text.primary} accessibilityLabel="" />
            <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]}>{strings.chatInfo.takePhoto}</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleGroupAvatarPick('library')}
            accessibilityRole="button"
            accessibilityLabel={strings.chatInfo.choosePhoto}
            style={({ pressed }) => [styles.avatarSheetRow, pressed && { backgroundColor: c.bg.pressed }]}
          >
            <Icon name="media.photo" size="md" color={c.text.primary} accessibilityLabel="" />
            <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]}>{strings.chatInfo.choosePhoto}</Text>
          </Pressable>
        </View>
      </BottomSheet>

      {loading ? (
        showLoading ? <View accessible accessibilityLabel="Loading">{Array.from({ length: SKELETON_ROWS }, (_, index) => <SkeletonRow key={index} />)}</View> : null
      ) : info === null ? (
        <ErrorState title={strings.chatInfo.unavailable} message={error ? strings.common.checkConnection : strings.chatInfo.unavailableBody} onRetry={() => void refresh()} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: theme.space[6] }]}>
          <Pressable
            style={[styles.profileFrame, { backgroundColor: c.bg.surface }]}
            onPress={() => {
              if (info.isGroup && info.isOwner) setAvatarSheetVisible(true);
              else router.push({ pathname: '/chat/[chatId]/profile', params: { chatId } });
            }}
            accessibilityRole="button"
            accessibilityLabel={info.isGroup && info.isOwner ? strings.chatInfo.changePicture : `Open ${shownTitle}'s profile`}
          >
            <Avatar id={info.avatarId} displayName={shownTitle} imageUrl={info.isGroup ? signedAvatarUrl : info.avatarUrl} variant="banner" bannerHeight={236} isSavedMessages={info.savedMessages} />
            {info.isGroup && info.isOwner ? <View style={[styles.cameraBadge, { backgroundColor: c.brand.primary }]}>{avatarUploading ? <ActivityIndicator size="small" color={c.text.inverse} /> : <Icon name="action.camera" size="sm" color={c.text.inverse} accessibilityLabel="" />}</View> : null}
            <Text style={[textStyle(theme.typeTokens.titleLg), styles.profileName, { color: c.text.primary }]} numberOfLines={1}>{shownTitle}</Text>
            <Text style={[textStyle(theme.typeTokens.bodyMd), styles.profileUsername, { color: c.text.secondary }]} numberOfLines={1}>{info.isGroup ? info.subtitle : info.subtitle ? `@${info.subtitle}` : ''}</Text>
          </Pressable>

          {preferences?.blocked ? <Text style={[textStyle(theme.typeTokens.bodySm), styles.offline, { color: c.error.text }]}>Blocked on this device</Text> : null}
          {offline ? <Text style={[textStyle(theme.typeTokens.bodySm), styles.offline, { color: c.text.secondary }]}>{strings.chatInfo.offline}</Text> : null}

          <HorizontalSection title="Chat Details">
            {info.isGroup ? <QuickAction width={108} iconName="action.edit" label={strings.chatInfo.groupName} disabled={offline || !info.isOwner} onPress={() => router.push({ pathname: '/chat/[chatId]/group-name', params: { chatId } })} /> : null}
            <QuickAction width={96} iconName="action.edit" label={strings.chatInfo.nicknames} onPress={() => router.push({ pathname: '/chat/[chatId]/nicknames', params: { chatId } })} />
            <QuickAction width={96} iconName="action.search" label={strings.chatInfo.search} onPress={() => router.push({ pathname: '/chat/[chatId]/search', params: { chatId } })} />
            <QuickAction width={112} iconName="action.pin" label={strings.chatInfo.pinnedMessages} onPress={() => router.push({ pathname: '/chat/[chatId]/pinned', params: { chatId } })} />
            <QuickAction width={96} iconName="nav.settings" label={strings.chatInfo.customise} onPress={() => router.push({ pathname: '/chat/[chatId]/customise', params: { chatId } })} />
          </HorizontalSection>

          {!info.isGroup && !info.savedMessages ? (
            <HorizontalSection title="Calling Options">
              <QuickAction width={108} iconName="action.phone" label={strings.chatInfo.voiceCall} disabled={!canCall} onPress={() => startCall('voice')} />
              <QuickAction width={108} iconName="action.camera" label={strings.chatInfo.videoCall} disabled={!canCall} onPress={() => startCall('video')} />
              <QuickAction width={116} iconName="action.phone" label={strings.chatInfo.callsHistory} onPress={() => router.push({ pathname: '/chat/[chatId]/calls', params: { chatId } })} />
            </HorizontalSection>
          ) : null}

          <HorizontalSection title="Chat Settings">
            {!info.savedMessages ? <QuickAction width={116} iconName={starred ? 'action.starOff' : 'action.star'} label={strings.chatInfo.menuAddStarred} onPress={() => void toggleStar()} /> : null}
            <QuickAction width={96} iconName={info.muted ? 'action.unmute' : 'action.mute'} label={strings.chatInfo.menuMute} disabled={offline || organizationBusy} onPress={() => (info.muted ? void updateOrganization({ muted_until: null }) : setMuteVisible(true))} />
            <QuickAction width={112} iconName="action.unmute" label={strings.chatInfo.notifications} onPress={() => router.push({ pathname: '/chat/[chatId]/notifications', params: { chatId } })} />
            {!info.isGroup && !info.savedMessages ? <QuickAction width={140} iconName="action.newGroup" label={strings.chatInfo.menuCreateGroup} onPress={() => router.push({ pathname: '/new-group', params: { groupWith: info.avatarId } })} /> : null}
            {info.isGroup ? <QuickAction width={100} iconName={info.archived ? 'action.unarchive' : 'action.archive'} label={info.archived ? strings.organization.unarchive : strings.organization.archive} disabled={offline || organizationBusy} onPress={() => void updateOrganization({ archived: !info.archived })} /> : null}
          </HorizontalSection>

          <View style={styles.managementSection}>
            {!info.isGroup && !info.savedMessages ? <InfoRow iconName="action.ignore" label={strings.chatInfo.menuBlock} onPress={() => setBlockVisible(true)} /> : null}
            <InfoRow iconName="action.delete" label={strings.chatInfo.menuDeleteChat} destructive onPress={() => setDeleteVisible(true)} />
          </View>

          {info.isGroup ? (
            <View style={styles.groupSection}>
              <View style={styles.sectionHeader}><Text style={[textStyle(theme.typeTokens.titleSm), { color: c.text.primary }]}>{strings.chatInfo.members}</Text><Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>{strings.chatInfo.membersCount(info.members.length)}</Text></View>
              {info.canAddMembers ? <Pressable style={({ pressed }) => [styles.addRow, { paddingHorizontal: theme.space[4], backgroundColor: pressed ? c.bg.pressed : 'transparent' }]} onPress={openAddMembers} disabled={offline} accessibilityRole="button" accessibilityLabel={strings.chatInfo.addMembers} accessibilityState={{ disabled: offline }}><View style={[styles.addIcon, { backgroundColor: c.bg.surface, borderRadius: 24, opacity: offline ? 0.5 : 1 }]}><Icon name="nav.new" size="md" color={c.brand.primary} accessibilityLabel="" /></View><Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.brand.primary }]}>{strings.chatInfo.addMembers}</Text></Pressable> : null}
              {info.members.map((member) => <MemberRow key={member.userId} member={member} canRemove={info.canManageMembers} disabled={offline || removing} onRemove={setRemoveTarget} />)}
              {info.canLeave ? <View style={styles.leaveRow}><Button label={strings.chatInfo.leave} variant="danger" onPress={() => setLeaveVisible(true)} disabled={offline || leaving || organizationBusy} /></View> : null}
            </View>
          ) : null}

          <View style={[styles.sharedSection, { borderTopColor: c.separator }]}>
            <View style={[styles.sharedTabs, { backgroundColor: c.bg.surface }]} accessibilityRole="tablist">
              {([
                ['media', strings.chatInfo.media, 'action.gallery'],
                ['files', strings.chatInfo.files, 'action.file'],
                ['links', strings.chatInfo.links, 'action.link'],
              ] as const).map(([tab, label, iconName]) => {
                const active = activeSharedTab === tab;
                return (
                  <Pressable key={tab} style={({ pressed }) => [styles.sharedTab, active && { backgroundColor: c.bg.elevated }, pressed && { backgroundColor: c.bg.pressed }]} onPress={() => setActiveSharedTab(tab)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }}>
                    <Icon name={iconName} size="md" color={active ? c.brand.primary : c.text.secondary} accessibilityLabel="" />
                    <Text style={[textStyle(theme.typeTokens.labelMd), styles.sharedTabLabel, { color: active ? c.brand.primary : c.text.secondary }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {sharedLoading ? <ActivityIndicator style={styles.sharedLoading} color={c.brand.primary} /> : activeSharedTab === 'links' ? (
              sharedLinks.length === 0 ? <SharedEmpty /> : sharedLinks.map(({ message, url }, index) => <Pressable key={`${message.messageId}-${url}-${index}`} style={({ pressed }) => [styles.sharedRow, pressed && { backgroundColor: c.bg.pressed }]} onPress={() => void Linking.openURL(url)} accessibilityRole="link" accessibilityLabel={url}><View style={[styles.sharedIcon, { backgroundColor: c.bg.surface }]}><Icon name="action.link" size="md" color={c.brand.primary} accessibilityLabel="" /></View><Text style={[textStyle(theme.typeTokens.bodyMd), styles.sharedText, { color: c.text.primary }]} numberOfLines={2}>{url}</Text><Icon name="nav.forward" size="sm" color={c.text.muted} accessibilityLabel="" /></Pressable>)
            ) : (
              (activeSharedTab === 'media' ? sharedMedia : sharedFiles).length === 0 ? <SharedEmpty /> : (activeSharedTab === 'media' ? sharedMedia : sharedFiles).map(({ attachment, message }) => <Pressable key={attachment.mediaId} style={({ pressed }) => [styles.sharedRow, pressed && { backgroundColor: c.bg.pressed }]} onPress={() => router.push({ pathname: '/chat/[chatId]/media/[mediaId]', params: { chatId, mediaId: attachment.mediaId } })} accessibilityRole="button" accessibilityLabel={`Open ${attachmentLabel(attachment.mediaType)}`}><View style={[styles.sharedIcon, { backgroundColor: c.bg.surface }]}><Icon name={attachment.mediaType === 'photo' ? 'media.photo' : attachment.mediaType === 'video' ? 'media.video' : 'media.file'} size="md" color={c.brand.primary} accessibilityLabel="" /></View><View style={styles.sharedText}><Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.primary }]}>{attachmentLabel(attachment.mediaType)}</Text><Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]} numberOfLines={1}>{message.content || 'Shared in chat'}</Text></View><Icon name="nav.forward" size="sm" color={c.text.muted} accessibilityLabel="" /></Pressable>)
            )}
          </View>
        </ScrollView>
      )}

      <BottomSheet visible={addVisible} onClose={() => { if (!adding) setAddVisible(false); }}>
        <View style={{ paddingBottom: theme.space[6] }}>
          <Text style={[textStyle(theme.typeTokens.titleMd), { color: c.text.primary, paddingHorizontal: theme.space[4], paddingBottom: theme.space[2] }]}>{strings.chatInfo.addMembers}</Text>
          {contacts.length === 0 ? <EmptyState iconName="action.newChat" title={strings.newGroup.noContacts} message={strings.newGroup.noContactsBody} /> : <ScrollView style={{ maxHeight: 320 }}>{contacts.map((contact) => <ContactRow key={contact.userId} userId={contact.userId} displayName={contact.displayName} avatarUrl={contact.avatarUrl} selected={addSelected.includes(contact.userId)} disabled={adding || !addSelected.includes(contact.userId) && addSelected.length >= maxSelectableMembers} onToggle={onToggleAdd} />)}</ScrollView>}
          <View style={{ paddingHorizontal: theme.space[4], paddingTop: theme.space[3] }}><Button label={strings.chatInfo.add} onPress={() => void onAddMembers()} disabled={offline || addSelected.length === 0 || adding} loading={adding} fullWidth /></View>
        </View>
      </BottomSheet>

      <BottomSheet visible={muteVisible} onClose={() => setMuteVisible(false)}>
        <View style={styles.muteSheet}>
          <Text style={[textStyle(theme.typeTokens.titleMd), styles.muteTitle, { color: c.text.primary }]}>{strings.organization.mute}</Text>
          <MuteOptionGrid disabled={offline || organizationBusy} onSelect={selectMute} />
        </View>
      </BottomSheet>

      <Dialog visible={removeTarget !== null} title={strings.chatInfo.removeTitle(removeTarget?.displayName ?? '')} message={strings.chatInfo.removeBody} confirmLabel={strings.chatInfo.remove} onConfirm={() => void onRemove()} onDismiss={() => { if (!removing) setRemoveTarget(null); }} destructive />
      <Dialog visible={leaveVisible} title={strings.chatInfo.leaveTitle} message={strings.chatInfo.leaveBody} confirmLabel={strings.chatInfo.leave} onConfirm={() => void onLeave()} onDismiss={() => setLeaveVisible(false)} destructive />
      <Dialog visible={blockVisible} title={strings.chatInfo.blockTitle(shownTitle)} message={strings.chatInfo.blockBody} confirmLabel={strings.chatInfo.blockConfirm} onConfirm={() => void onBlock()} onDismiss={() => setBlockVisible(false)} destructive />
      <Dialog visible={deleteVisible} title={strings.chatInfo.deleteTitle} message={strings.chatInfo.deleteBody} confirmLabel={strings.chatInfo.deleteChat} onConfirm={() => void onDelete()} onDismiss={() => { if (!destructiveBusy) setDeleteVisible(false); }} destructive />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  profileFrame: {
    width: '100%', height: 236, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden',
  },
  profileName: { position: 'absolute', left: 16, bottom: 16, maxWidth: '62%' },
  profileUsername: { position: 'absolute', right: 16, bottom: 18, maxWidth: '34%' },
  cameraBadge: {
    position: 'absolute', right: 16, bottom: 52, width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  offline: { paddingHorizontal: 16, paddingBottom: 12 },
  quickAction: { minHeight: 88, alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 6, borderRadius: 12, gap: 6 },
  quickIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { textAlign: 'center', minHeight: 30 },
  muteSheet: { paddingBottom: 12, gap: 8 },
  muteTitle: { paddingHorizontal: 16, paddingTop: 4 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 6 },
  horizontalSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 10 },
  horizontalRow: { paddingHorizontal: 12, gap: 4 },
  menu: { paddingVertical: 4 },
  menuItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20 },
  managementSection: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  infoRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 8 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  dangerSection: { marginTop: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  groupSection: { paddingTop: 22, paddingBottom: 8 },
  addRow: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  addIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  leaveRow: { alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 12 },
  sharedSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  sharedTabs: { flexDirection: 'row', gap: 4, marginHorizontal: 12, padding: 4, borderRadius: 20 },
  sharedTab: { flex: 1, minWidth: 0, height: 44, borderRadius: 16, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sharedTabLabel: { flexShrink: 1 },
  sharedLoading: { padding: 24 },
  sharedEmpty: { alignItems: 'center', gap: 4, paddingHorizontal: 20, paddingVertical: 28 },
  sharedRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  sharedIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sharedText: { flex: 1 },
  avatarSheet: { gap: 4 },
  avatarSheetRow: {
    minHeight: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16,
  },
});
