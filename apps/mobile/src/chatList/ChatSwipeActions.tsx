import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { conversationIdentity, mutedUntil, strings, updateOwnMember, type ChatListItem } from '@dologram/shared';
import { memoMute, memoPreference } from '../memos/organization';
import { useAuth } from '../auth/AuthProvider';
import { useNetState } from '../net/netState';
import { supabase } from '../lib/supabase';
import { getLocalDatabase } from '../queue/db';
import { cacheMember } from '../chat/readState';
import { notifyCacheChange } from '../sync/cacheEvents';
import { deleteChatFromDevice } from './deleteChat';
import { setChatListPreference } from './preferences';
import { updateChatPreferences } from '../chats/preferences';
import { actionToast, type ToastAction } from '../notifications/toastCopy';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from '../components/Icon';
import { ChatRow } from '../components/ChatRow';

/* Reanimated shared values are intentionally mutated by the UI-thread gesture worklet. */
/* eslint-disable react-hooks/immutability */

export type ChatListSection = 'chats' | 'archive' | 'ignored' | 'blocked';
export type ChatSwipeActionKey = 'star' | 'archive' | 'unarchive' | 'ignore' | 'unignore' | 'unblock' | 'mute' | 'unmute' | 'delete';
export type ChatSelectionPhase = 'idle' | 'entering' | 'active' | 'exiting';

export type ChatSwipeAction = {
  key: ChatSwipeActionKey;
  iconName: string;
  label: string;
  destructive?: boolean;
  onPress?: () => void;
};

type MutationRequest = { item: ChatListItem; action: ChatSwipeActionKey; section: ChatListSection };

/** Executes the same local/server mutations used by the organization sheet. */
export function useChatSwipeMutations(onDelete: (chatIds: string[]) => void) {
  const { session } = useAuth();
  const net = useNetState();
  const { showToast } = useToast();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);

  const execute = useCallback(async (requests: readonly MutationRequest[]) => {
    const userId = session?.user.id;
    if (!userId || requests.length === 0 || lock.current) return;

    const deleteIds = requests.filter((request) => request.action === 'delete').map((request) => request.item.chatId);
    if (deleteIds.length > 0) {
      onDelete(deleteIds);
      return;
    }
    if (!net.isConnected && requests.some(({ item, action }) => conversationIdentity(item.chatId).kind === 'chat' && (action === 'archive' || action === 'unarchive' || action === 'mute' || action === 'unmute'))) return;

    lock.current = true;
    setBusy(true);
    try {
      for (const { item, action, section } of requests) {
        if (conversationIdentity(item.chatId).kind === 'memo') {
          if (action === 'star') {
            await memoPreference(item.chatId, 'pinned', !item.pinned);
            if (!item.pinned && section === 'archive') await memoPreference(item.chatId, 'archived', false);
            if (!item.pinned && section === 'ignored') await memoPreference(item.chatId, 'ignored', false);
          } else if (action === 'archive' || action === 'unarchive') await memoPreference(item.chatId, 'archived', action === 'archive');
          else if (action === 'ignore' || action === 'unignore') await memoPreference(item.chatId, 'ignored', action === 'ignore');
          else if (action === 'mute' || action === 'unmute') await memoMute(item.chatId, action === 'mute' ? mutedUntil('untilUnmuted', new Date()) : null);
          continue;
        }
        if (action === 'star') {
          const shouldStar = !item.pinned;
          await setChatListPreference(userId, item.chatId, 'pinned', shouldStar);
          // Starred archived/ignored rows leave their special list as requested.
          if (shouldStar && section === 'archive') {
            const result = await updateOwnMember(supabase, item.chatId, userId, { archived: false });
            if (result.error) throw result.error;
            await cacheMember(await getLocalDatabase(), result.data).catch(() => undefined);
          }
          if (shouldStar && section === 'ignored') {
            await setChatListPreference(userId, item.chatId, 'ignored', false);
          }
        } else if (action === 'ignore' || action === 'unignore') {
          await setChatListPreference(userId, item.chatId, 'ignored', action === 'ignore');
        } else if (action === 'unblock') {
          await updateChatPreferences(userId, item.chatId, { blocked: false });
        } else if (action === 'archive' || action === 'unarchive') {
          const result = await updateOwnMember(supabase, item.chatId, userId, { archived: action === 'archive' });
          if (result.error) throw result.error;
          await cacheMember(await getLocalDatabase(), result.data).catch(() => undefined);
          if (action === 'archive' && section === 'ignored') {
            await setChatListPreference(userId, item.chatId, 'ignored', false);
          }
        } else if (action === 'mute' || action === 'unmute') {
          const result = await updateOwnMember(supabase, item.chatId, userId, {
            muted_until: action === 'mute' ? mutedUntil('untilUnmuted', new Date()) : null,
          });
          if (result.error) throw result.error;
          await cacheMember(await getLocalDatabase(), result.data).catch(() => undefined);
        }
      }
      notifyCacheChange();
      const feedback = feedbackFor(requests[0]);
      if (feedback) showToast(actionToast(feedback, 'success'));
    } catch {
      const feedback = feedbackFor(requests[0]);
      showToast(feedback ? actionToast(feedback, 'error') : { message: strings.organization.actionFailed, variant: 'error' });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [net.isConnected, onDelete, session?.user.id, showToast]);

  const confirmDelete = useCallback(async (chatIds: readonly string[]) => {
    const userId = session?.user.id;
    if (!userId || chatIds.length === 0 || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await Promise.all(chatIds.filter((chatId) => conversationIdentity(chatId).kind === 'chat').map((chatId) => deleteChatFromDevice(userId, chatId)));
      notifyCacheChange();
      showToast(actionToast('deleteChat', 'success'));
    } catch {
      showToast(actionToast('deleteChat', 'error'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [session?.user.id, showToast]);

  return { execute, confirmDelete, busy };
}

function feedbackFor({ action, item }: MutationRequest): ToastAction | null {
  switch (action) {
    case 'star': return item.pinned ? 'unstarChat' : 'starChat';
    case 'archive': return 'archiveChat';
    case 'unarchive': return 'unarchiveChat';
    case 'ignore': return 'ignoreChat';
    case 'unignore': return 'unignoreChat';
    case 'unblock': return 'unblockChat';
    case 'mute': return 'muteChat';
    case 'unmute': return 'unmuteChat';
    case 'delete': return 'deleteChat';
    default: return null;
  }
}

export function actionsForChat(
  item: ChatListItem,
  section: ChatListSection,
  onAction: (action: ChatSwipeActionKey) => void,
): ChatSwipeAction[] {
  const star = { key: 'star' as const, iconName: item.pinned ? 'action.starOff' : 'action.star', label: item.pinned ? strings.organization.unstar : strings.organization.star };
  const mute = { key: (item.muted ? 'unmute' : 'mute') as ChatSwipeActionKey, iconName: item.muted ? 'action.unmute' : 'action.mute', label: item.muted ? strings.organization.unmute : strings.organization.mute };
  const deleteAction = { key: 'delete' as const, iconName: 'action.delete', label: strings.organization.deleteConversation, destructive: true };
  const bind = (action: ChatSwipeAction): ChatSwipeAction => ({ ...action, onPress: () => onAction(action.key) });
  if (conversationIdentity(item.chatId).kind === 'memo') return [
    bind(star), bind({ key: item.archived ? 'unarchive' : 'archive', iconName: 'action.archive', label: item.archived ? strings.organization.unarchive : strings.organization.archive }),
    bind({ key: section === 'ignored' ? 'unignore' : 'ignore', iconName: 'action.ignore', label: section === 'ignored' ? strings.organization.unignore : strings.organization.ignore }), bind(mute),
  ];

  if (section === 'blocked') {
    return [
      bind({ key: 'unblock', iconName: 'action.ignore', label: strings.organization.unblock }),
      bind(star),
      bind({ key: item.archived ? 'unarchive' : 'archive', iconName: item.archived ? 'action.unarchive' : 'action.archive', label: item.archived ? strings.organization.unarchive : strings.organization.archive }),
      bind(mute),
      bind(deleteAction),
    ];
  }

  if (section === 'archive') {
    return [
      bind({ key: 'unarchive', iconName: 'action.unarchive', label: strings.organization.unarchive }),
      bind(star),
      bind({ key: 'ignore', iconName: 'action.ignore', label: strings.organization.ignore }),
      bind(mute),
      bind(deleteAction),
    ];
  }
  if (section === 'ignored') {
    return [
      bind({ key: 'unignore', iconName: 'action.unignore', label: strings.organization.unignore }),
      bind(star),
      bind({ key: 'archive', iconName: 'action.archive', label: strings.organization.archive }),
      bind(mute),
      bind(deleteAction),
    ];
  }
  return [
    bind(star),
    bind({ key: 'archive', iconName: 'action.archive', label: strings.organization.archive }),
    bind({ key: 'ignore', iconName: 'action.ignore', label: strings.organization.ignore }),
    bind(mute),
    bind(deleteAction),
  ];
}

export function ChatSwipeableRow({
  item,
  section,
  compactPreview = false,
  onPress,
  onLongPress,
  onSelect,
  selected = false,
  selectionMode = false,
  selectionPhase = 'idle',
  onAction,
}: {
  item: ChatListItem;
  section: ChatListSection;
  compactPreview?: boolean;
  onPress: (chatId: string) => void;
  onLongPress?: (item: ChatListItem) => void;
  onSelect?: (item: ChatListItem) => void;
  selected?: boolean;
  selectionMode?: boolean;
  selectionPhase?: ChatSelectionPhase;
  onAction: (item: ChatListItem, action: ChatSwipeActionKey) => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  // Worklets capture whole objects. Keep the theme's native Animated.Value
  // (transitionOpacity) on the JS thread by capturing only this boolean.
  const reduceMotion = theme.reduceMotion;
  const actions = useMemo(() => actionsForChat(item, section, (action) => onAction(item, action)), [item, onAction, section]);
  const width = actions.length * ACTION_WIDTH;
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const timing = useCallback((toValue: number, duration: number) => withTiming(toValue, {
    duration: reduceMotion ? 0 : duration,
    easing: Easing.out(Easing.cubic),
  }), [reduceMotion]);
  const close = useCallback(() => {
    translateX.value = timing(0, CLOSE_ANIMATION_MS);
  }, [timing, translateX]);
  useEffect(() => {
    // The swiped row already rests at the rail width. Every other row catches
    // up to that exact position, preserving avatars and list geometry.
    const target = selectionMode && selectionPhase !== 'exiting' ? SELECT_RAIL_WIDTH : 0;
    translateX.value = timing(target, SELECTION_TRANSITION_MS);
  }, [selectionMode, selectionPhase, timing, translateX]);
  const gesture = useMemo(() => Gesture.Pan()
    .minDistance(6)
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      if (selectionMode) return;
      cancelAnimation(translateX);
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      if (selectionMode) return;
      const next = startX.value + event.translationX;
      translateX.value = Math.max(-width, Math.min(SELECT_RAIL_WIDTH, next));
    })
    .onEnd((event) => {
      if (selectionMode) return;
      const startedClosed = Math.abs(startX.value) < 1;
      if (startedClosed && event.translationX > SWIPE_SELECT_DISTANCE) {
        // Hold the row where the finger left it. Selection mode moves the
        // remaining rows to this same position without disturbing this row.
        translateX.value = SELECT_RAIL_WIDTH;
        if (onSelect) runOnJS(onSelect)(item);
      } else if (event.translationX < -SWIPE_ACTION_DISTANCE || translateX.value < -width / 2) {
        translateX.value = withTiming(-width, {
          duration: reduceMotion ? 0 : SWIPE_ANIMATION_MS,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        translateX.value = withTiming(0, {
          duration: reduceMotion ? 0 : CLOSE_ANIMATION_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
    }), [item, onSelect, selectionMode, startX, reduceMotion, translateX, width]);
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  // Android can apply a screen fade to overlapping children individually.
  // Don't draw covered controls: otherwise they bleed through the row during
  // navigation and the initial loading reveal, even though it is closed.
  const selectPreviewStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, translateX.value / 12)),
  }));
  const actionStripStyle = useAnimatedStyle(() => ({ opacity: translateX.value < 0 ? 1 : 0 }));

  return (
    <View style={[styles.swipeFrame, { backgroundColor: c.bg.surface }]}>
      <>
          <Animated.View
            testID="chat-selection-rail"
            style={[
              styles.selectPreview,
              { width: SELECT_RAIL_WIDTH, backgroundColor: c.brand.primary, borderBottomColor: c.separator },
              selectPreviewStyle,
            ]}
            pointerEvents={selectionMode ? 'auto' : 'none'}
          >
            <Pressable
              style={styles.selectRailButton}
              onPress={() => onSelect?.(item)}
              accessible={false}
            >
            <Icon name="action.select" size="md" color={c.text.inverse} accessibilityLabel="" />
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.actionStrip, { width, backgroundColor: c.bg.surface }, actionStripStyle]}>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                style={({ pressed }) => [styles.actionButton, { backgroundColor: pressed ? c.bg.pressed : c.bg.surface }]}
                onPress={() => { close(); action.onPress?.(); }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                disabled={false}
              >
                <Icon name={action.iconName} size="md" color={action.destructive ? c.error.text : c.text.primary} accessibilityLabel="" />
              </Pressable>
            ))}
          </Animated.View>
        </>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[rowStyle, styles.foreground]}>
          <ChatRow
            item={item}
            onPress={selectionMode ? () => onSelect?.(item) : onPress}
            onLongPress={selectionMode ? undefined : onLongPress}
            compactPreview={compactPreview}
            selectionMode={selectionMode}
            selected={selected}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const ACTION_WIDTH = 52;
const SWIPE_ACTION_DISTANCE = 56;
const SWIPE_SELECT_DISTANCE = 56;
const SWIPE_ANIMATION_MS = 240;
const CLOSE_ANIMATION_MS = 200;
const SELECTION_TRANSITION_MS = 250;
const SELECTION_HEADER_FADE_MS = 200;
const SELECT_RAIL_WIDTH = 56;
const MODE_HEADER_HEIGHT = 44;

/** Crossfades the filter tabs and selection actions without changing layout height. */
export function ChatListModeHeader({
  phase,
  defaultContent,
  selectionContent,
  onEntered,
  onExited,
  collapseWhenIdle = false,
}: {
  phase: ChatSelectionPhase;
  defaultContent: React.ReactNode;
  selectionContent: React.ReactNode;
  onEntered: () => void;
  onExited: () => void;
  collapseWhenIdle?: boolean;
}) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const target = phase === 'entering' || phase === 'active' ? 1 : 0;

  useEffect(() => {
    if (phase !== 'entering' && phase !== 'exiting') return;
    const animation = withTiming(target, {
      duration: theme.reduceMotion ? 0 : phase === 'entering' ? SELECTION_HEADER_FADE_MS : SELECTION_TRANSITION_MS,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (!finished) return;
      runOnJS(target === 1 ? onEntered : onExited)();
    });
    progress.value = phase === 'entering' && !theme.reduceMotion
      ? withDelay(SELECTION_TRANSITION_MS, animation)
      : animation;
  }, [onEntered, onExited, phase, progress, target, theme.reduceMotion]);

  const defaultStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));
  const selectionStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const containerStyle = useAnimatedStyle(() => ({
    height: collapseWhenIdle ? MODE_HEADER_HEIGHT * progress.value : MODE_HEADER_HEIGHT,
  }));

  return (
    <Animated.View testID="chat-list-mode-header" style={[styles.modeHeader, containerStyle]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, defaultStyle]}
        pointerEvents={phase === 'idle' ? 'auto' : 'none'}
        accessibilityElementsHidden={phase !== 'idle'}
        importantForAccessibility={phase === 'idle' ? 'auto' : 'no-hide-descendants'}
      >
        {defaultContent}
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, selectionStyle]}
        pointerEvents={phase === 'active' ? 'auto' : 'none'}
        accessibilityElementsHidden={phase !== 'active'}
        importantForAccessibility={phase === 'active' ? 'auto' : 'no-hide-descendants'}
      >
        {selectionContent}
      </Animated.View>
    </Animated.View>
  );
}

export function ChatSelectionToolbar({
  items,
  section,
  selectedIds,
  onClose,
  onSelectAll,
  onAction,
  busy = false,
}: {
  items: readonly ChatListItem[];
  section: ChatListSection;
  selectedIds: readonly string[];
  onClose: () => void;
  onSelectAll: () => void;
  onAction: (action: ChatSwipeActionKey) => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const selected = items.filter((item) => selectedIds.includes(item.chatId));
  const actionItems = selected.length > 0 ? actionsForChat(selected[0], section, onAction) : [];
  const unique = actionItems.filter((action, index) => actionItems.findIndex((candidate) => candidate.key === action.key) === index && (action.key !== 'delete' || !selected.some((item) => conversationIdentity(item.chatId).kind === 'memo')));
  return (
    <View style={[styles.selectionToolbar, { backgroundColor: c.bg.chatList, borderBottomColor: c.separator }]}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close selection mode" style={styles.toolbarButton}>
        <Icon name="nav.close" size="md" color={c.text.primary} accessibilityLabel="" />
      </Pressable>
      <Text style={[textStyle(theme.typeTokens.titleSm), styles.selectionCount, { color: c.text.primary }]}>{selectedIds.length}</Text>
      <Pressable onPress={onSelectAll} accessibilityRole="button" accessibilityLabel={selectedIds.length === items.length ? 'Clear selection' : 'Select all'} style={styles.toolbarButton} disabled={busy}>
        <Icon name="action.select" size="md" color={c.brand.primary} accessibilityLabel="" />
      </Pressable>
      {selected.length > 0 ? unique.map((action) => (
        <Pressable key={action.key} onPress={() => onAction(action.key)} accessibilityRole="button" accessibilityLabel={action.label} style={styles.toolbarButton} disabled={busy}>
          <Icon name={action.iconName} size="md" color={action.destructive ? c.error.text : c.text.primary} accessibilityLabel="" />
        </Pressable>
      )) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  swipeFrame: { width: '100%', overflow: 'hidden' },
  foreground: { width: '100%' },
  selectPreview: { position: 'absolute', top: 0, bottom: 0, left: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  selectRailButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actionStrip: { position: 'absolute', top: 0, bottom: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  actionButton: { width: ACTION_WIDTH, height: 72, alignItems: 'center', justifyContent: 'center' },
  modeHeader: { overflow: 'hidden' },
  selectionToolbar: { height: 44, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4 },
  toolbarButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  selectionCount: { minWidth: 28, textAlign: 'center' },
});
