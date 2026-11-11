/** Messenger-style Chat Info / Conversation Details screen. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { Button } from '../../../src/components/Button';
import { ContactRow } from '../../../src/components/ContactRow';
import { Dialog } from '../../../src/components/Dialog';
import { EmptyState, ErrorState } from '../../../src/components/EmptyState';
import { MemberRow } from '../../../src/components/MemberRow';
import { SkeletonRow } from '../../../src/components/Skeleton';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { Icon } from '../../../src/components/Icon';
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
import { deleteCachedChat } from '../../../src/sync/localCache';
import { notifyCacheChange } from '../../../src/sync/cacheEvents';
import { resyncNow } from '../../../src/sync/lifecycle';
import { deleteChatFromDevice } from '../../../src/chatList/deleteChat';
import { loadChatListPreferences, setChatListPreference } from '../../../src/chatList/preferences';
import { useDelayedFlag } from '../../../src/hooks/useDelayedFlag';
import { cacheMembers } from '../../../src/chat/readState';
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
  onPress: () => void;
};

function QuickAction({ iconName, label, disabled = false, onPress }: QuickActionProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.quickAction,
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
      await deleteCachedChat(db, chatId);
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
          await cacheMembers(await getLocalDatabase(), [result.data]);
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

  const removeChatFromDevice = useCallback(async (clearPreferences: boolean) => {
    if (!chatId) return;
    const db = await getLocalDatabase();
    await deleteCachedChat(db, chatId);
    if (clearPreferences && userId) await clearChatPreferences(userId, chatId);
    notifyCacheChange();
    router.replace('/(main)/(tabs)');
  }, [chatId, router, userId]);

  const onBlock = useCallback(async () => {
    if (destructiveBusy || mutationLock.current) return;
    mutationLock.current = true;
    setDestructiveBusy(true);
    try {
      if (!(await updatePreferences({ blocked: true }))) return;
      await removeChatFromDevice(false);
    } catch {
      showToast({ message: strings.chatInfo.blockFailed });
    } finally {
      mutationLock.current = false;
      setDestructiveBusy(false);
      setBlockVisible(false);
    }
  }, [destructiveBusy, removeChatFromDevice, showToast, updatePreferences]);

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

  return (
    <View style={[styles.screen, { backgroundColor: c.bg.app }]}>
      <TopBar title={strings.chatInfo.title} onBack={() => goBackOrReplace(router, chatId ? { pathname: '/chat/[chatId]', params: { chatId } } : '/(main)/(tabs)')} />

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
          <View style={[styles.header, { padding: theme.space[5], gap: theme.space[3] }]}>
            <Pressable
              onPress={() => setAvatarSheetVisible(true)}
              disabled={!info.isGroup || !info.isOwner || avatarUploading || offline}
              accessibilityRole={info.isGroup && info.isOwner ? 'button' : undefined}
              accessibilityLabel={info.isGroup && info.isOwner ? strings.chatInfo.changePicture : shownTitle}
              accessibilityState={{ disabled: !info.isGroup || !info.isOwner || avatarUploading || offline }}
              style={styles.avatarButton}
            >
              <Avatar id={info.avatarId} displayName={shownTitle} imageUrl={info.isGroup ? signedAvatarUrl : info.avatarUrl} size={96} isSavedMessages={info.savedMessages} />
              {info.isGroup && info.isOwner ? (
                <View style={[styles.cameraBadge, { backgroundColor: c.brand.primary }]}>
                  {avatarUploading ? <ActivityIndicator size="small" color={c.text.inverse} /> : <Icon name="action.camera" size="sm" color={c.text.inverse} accessibilityLabel="" />}
                </View>
              ) : null}
            </Pressable>
            <Text style={[textStyle(theme.typeTokens.titleLg), { color: c.text.primary, textAlign: 'center' }]} numberOfLines={2}>{shownTitle}</Text>
            {info.subtitle.length > 0 ? <Text style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary }]} numberOfLines={1}>{info.subtitle}</Text> : null}
            {preferences?.blocked ? <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.error.text }]}>Blocked on this device</Text> : null}
          </View>

          {offline ? <Text style={[textStyle(theme.typeTokens.bodySm), styles.offline, { color: c.text.secondary }]}>{strings.chatInfo.offline}</Text> : null}

          <View style={[styles.quickRow, { paddingHorizontal: theme.space[3], paddingBottom: theme.space[4] }]}>
            {info.isGroup ? <QuickAction iconName="action.edit" label={strings.chatInfo.groupName} disabled={offline || !info.isOwner} onPress={() => router.push({ pathname: '/chat/[chatId]/group-name', params: { chatId } })} /> : null}
            <QuickAction iconName="action.edit" label={strings.chatInfo.nicknames} onPress={() => router.push({ pathname: '/chat/[chatId]/nicknames', params: { chatId } })} />
            <QuickAction iconName="action.search" label={strings.chatInfo.search} onPress={() => router.push({ pathname: '/chat/[chatId]/search', params: { chatId } })} />
            <QuickAction iconName="nav.settings" label={strings.chatInfo.customise} onPress={() => router.push({ pathname: '/chat/[chatId]/customise', params: { chatId } })} />
          </View>

          <View style={[styles.section, { borderTopColor: c.separator, borderBottomColor: c.separator }]}>
            <InfoRow iconName="action.gallery" label={strings.chatInfo.mediaFilesLinks} onPress={() => router.push({ pathname: '/chat/[chatId]/media', params: { chatId } })} />
            <InfoRow iconName="action.pin" label={strings.chatInfo.pinnedMessages} onPress={() => router.push({ pathname: '/chat/[chatId]/pinned', params: { chatId } })} />
          </View>

          <Text style={[textStyle(theme.typeTokens.titleSm), styles.sectionTitle, { color: c.text.secondary }]}>Actions</Text>
          <View style={styles.section}>
            {!info.savedMessages ? <InfoRow iconName={starred ? 'action.starOff' : 'action.star'} label={starred ? strings.chatInfo.unstar : strings.chatInfo.star} onPress={() => void toggleStar()} /> : null}
            <InfoRow iconName={info.muted ? 'action.unmute' : 'action.mute'} label={info.muted ? strings.chatInfo.unmute(shownTitle) : strings.chatInfo.mute(shownTitle)} detail={info.muted ? strings.organization.untilUnmuted : undefined} disabled={offline || organizationBusy} onPress={() => (info.muted ? void updateOrganization({ muted_until: null }) : setMuteVisible(true))} />
            <InfoRow iconName="action.unmute" label={strings.chatInfo.notifications} detail={preferences?.notifications === false ? strings.chatInfo.off : strings.chatInfo.on} onPress={() => router.push({ pathname: '/chat/[chatId]/notifications', params: { chatId } })} />
            {!info.isGroup && !info.savedMessages ? <InfoRow iconName="action.newGroup" label={strings.chatInfo.createGroup(shownTitle)} onPress={() => router.push({ pathname: '/new-group', params: { groupWith: info.avatarId } })} /> : null}
            {info.isGroup ? <InfoRow iconName={info.archived ? 'action.unarchive' : 'action.archive'} label={info.archived ? strings.organization.unarchive : strings.organization.archive} disabled={offline || organizationBusy} onPress={() => void updateOrganization({ archived: !info.archived })} /> : null}
            {!info.isGroup && !info.savedMessages ? <InfoRow iconName="action.ignore" label={strings.chatInfo.block(shownTitle)} onPress={() => setBlockVisible(true)} /> : null}
          </View>

          {info.isGroup ? (
            <View style={styles.groupSection}>
              <View style={styles.sectionHeader}><Text style={[textStyle(theme.typeTokens.titleSm), { color: c.text.primary }]}>{strings.chatInfo.members}</Text><Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}>{strings.chatInfo.membersCount(info.members.length)}</Text></View>
              {info.canAddMembers ? <Pressable style={({ pressed }) => [styles.addRow, { paddingHorizontal: theme.space[4], backgroundColor: pressed ? c.bg.pressed : 'transparent' }]} onPress={openAddMembers} disabled={offline} accessibilityRole="button" accessibilityLabel={strings.chatInfo.addMembers} accessibilityState={{ disabled: offline }}><View style={[styles.addIcon, { backgroundColor: c.bg.surface, borderRadius: 24, opacity: offline ? 0.5 : 1 }]}><Icon name="nav.new" size="md" color={c.brand.primary} accessibilityLabel="" /></View><Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.brand.primary }]}>{strings.chatInfo.addMembers}</Text></Pressable> : null}
              {info.members.map((member) => <MemberRow key={member.userId} member={member} canRemove={info.canManageMembers} disabled={offline || removing} onRemove={setRemoveTarget} />)}
              {info.canLeave ? <View style={styles.leaveRow}><Button label={strings.chatInfo.leave} variant="danger" onPress={() => setLeaveVisible(true)} disabled={offline || leaving || organizationBusy} /></View> : null}
            </View>
          ) : null}

          <View style={[styles.section, styles.dangerSection, { borderTopColor: c.separator }]}><InfoRow iconName="action.delete" label={strings.chatInfo.deleteChat} destructive onPress={() => setDeleteVisible(true)} /></View>
        </ScrollView>
      )}

      <BottomSheet visible={addVisible} onClose={() => { if (!adding) setAddVisible(false); }}>
        <View style={{ paddingBottom: theme.space[6] }}>
          <Text style={[textStyle(theme.typeTokens.titleMd), { color: c.text.primary, paddingHorizontal: theme.space[4], paddingBottom: theme.space[2] }]}>{strings.chatInfo.addMembers}</Text>
          {contacts.length === 0 ? <EmptyState iconName="action.newChat" title={strings.newGroup.noContacts} message={strings.newGroup.noContactsBody} /> : <ScrollView style={{ maxHeight: 320 }}>{contacts.map((contact) => <ContactRow key={contact.userId} userId={contact.userId} displayName={contact.displayName} selected={addSelected.includes(contact.userId)} disabled={adding || !addSelected.includes(contact.userId) && addSelected.length >= maxSelectableMembers} onToggle={onToggleAdd} />)}</ScrollView>}
          <View style={{ paddingHorizontal: theme.space[4], paddingTop: theme.space[3] }}><Button label={strings.chatInfo.add} onPress={() => void onAddMembers()} disabled={offline || addSelected.length === 0 || adding} loading={adding} fullWidth /></View>
        </View>
      </BottomSheet>

      <BottomSheet visible={muteVisible} onClose={() => setMuteVisible(false)}>
        <View style={{ paddingBottom: theme.space[5] }}>
          <Text style={[textStyle(theme.typeTokens.titleMd), { color: c.text.primary, padding: theme.space[4] }]}>{strings.organization.mute}</Text>
          {([
            ['oneHour', strings.organization.oneHour],
            ['eightHours', strings.organization.eightHours],
            ['oneWeek', strings.organization.oneWeek],
            ['untilUnmuted', strings.organization.untilUnmuted],
          ] as const).map(([option, label]) => <QuickAction key={option} iconName="action.mute" label={label} disabled={offline || organizationBusy} onPress={() => selectMute(option)} />)}
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
  header: { alignItems: 'center' },
  avatarButton: { position: 'relative' },
  cameraBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  offline: { paddingHorizontal: 16, paddingBottom: 12 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  quickAction: { flex: 1, minHeight: 88, alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 6, borderRadius: 12, gap: 6 },
  quickIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { textAlign: 'center', minHeight: 30 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 6 },
  infoRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 8 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  dangerSection: { marginTop: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  groupSection: { paddingTop: 22, paddingBottom: 8 },
  addRow: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  addIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  leaveRow: { alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 12 },
  avatarSheet: { gap: 4 },
  avatarSheetRow: {
    minHeight: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16,
  },
});
