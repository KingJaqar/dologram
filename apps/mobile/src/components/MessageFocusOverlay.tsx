/** CMP-34 / AND-06: Messenger-style long-press message actions. */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { config, strings } from '@dologram/shared';
import { ToastModalHost } from './Toast';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';
import type { ChatMessageItem } from '../chat/query';

export type MessageFocusOverlayProps = {
  visible: boolean;
  item: ChatMessageItem | null;
  own: boolean;
  userId: string;
  online: boolean;
  discardDisabled: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onForward: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onDiscard: () => void;
  pinned?: boolean;
  onPin?: () => void;
};

type QuickActionProps = {
  label: string;
  iconName: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

function QuickAction({ label, iconName, onPress, disabled = false, destructive = false }: QuickActionProps) {
  const theme = useTheme();
  const c = theme.colors;
  const color = destructive ? c.error.text : c.brand.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.quickAction, { backgroundColor: pressed && !disabled ? c.bg.pressed : 'transparent', opacity: disabled ? 0.42 : 1 }]}
    >
      <Icon name={iconName} size="lg" color={color} accessibilityLabel="" />
      <Text style={[textStyle(theme.typeTokens.labelMd), { color }]}>{label}</Text>
    </Pressable>
  );
}

type MoreActionProps = {
  label: string;
  iconName: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

function MoreAction({ label, iconName, onPress, disabled = false, destructive = false }: MoreActionProps) {
  const theme = useTheme();
  const c = theme.colors;
  const color = destructive ? c.error.text : c.text.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.moreAction, { backgroundColor: pressed && !disabled ? c.bg.pressed : 'transparent', opacity: disabled ? 0.42 : 1 }]}
    >
      <Icon name={iconName} size="md" color={color} accessibilityLabel="" />
      <Text style={[textStyle(theme.typeTokens.bodyLg), { color }]}>{label}</Text>
    </Pressable>
  );
}

export function MessageFocusOverlay({
  visible,
  item,
  own,
  userId,
  online,
  discardDisabled,
  onClose,
  onReact,
  onReply,
  onForward,
  onCopy,
  onEdit,
  onDelete,
  onRetry,
  onDiscard,
  pinned = false,
  onPin,
}: MessageFocusOverlayProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [moreVisible, setMoreVisible] = useState(false);
  const [showAllReactions, setShowAllReactions] = useState(false);
  const sheetY = useRef(new Animated.Value(600)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setMoreVisible(false);
      setShowAllReactions(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!moreVisible) return;
    sheetY.setValue(theme.reduceMotion ? 0 : 600);
    sheetOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(sheetY, { toValue: 0, duration: theme.duration('modal'), useNativeDriver: true }),
      Animated.timing(sheetOpacity, { toValue: 1, duration: theme.duration('modal'), useNativeDriver: true }),
    ]).start();
  }, [moreVisible, sheetOpacity, sheetY, theme]);

  if (!item) return null;

  const deleted = item.deletedAt !== null;
  const failed = item.pending?.status === 'failed';
  const ownReactionCount = item.reactions.filter((reaction) => reaction.user_id === userId).length;
  const reactionDisabled = deleted || !online || Boolean(item.pending);
  const reactionLimitReached = ownReactionCount >= config.reactions.maxActivePerMessage;
  const canEditOrDelete = own && !deleted && !item.pending && online;
  const canPin = !deleted && !item.pending;
  const hasText = Boolean(item.content.trim());
  const palette = showAllReactions ? [...config.reactions.palette, ...config.reactions.extraPalette] : config.reactions.palette.slice(0, 6);
  const closeMore = () => setMoreVisible(false);
  const preview = deleted ? strings.chat.deletedMessage : item.content || strings.chat.attachmentOnly;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={moreVisible ? closeMore : onClose}
      accessibilityViewIsModal
    >
      <View style={styles.screen}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
          onPress={moreVisible ? closeMore : onClose}
          accessibilityLabel={moreVisible ? 'Close more actions' : 'Close message actions'}
        />

        {!moreVisible ? (
          <View style={styles.focusLayout} pointerEvents="box-none">
            <View style={[styles.selectedArea, own ? styles.alignEnd : styles.alignStart]} pointerEvents="box-none">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.reactionScroll}
                style={[styles.reactionScroller, { backgroundColor: c.bg.elevated, borderColor: c.separator, elevation: theme.elevation[2].android }]}
                accessibilityLabel="Message reactions"
              >
                {palette.map((emoji) => {
                  const selected = item.reactions.some((reaction) => reaction.user_id === userId && reaction.emoji === emoji);
                  const disabled = reactionDisabled || (!selected && reactionLimitReached);
                  return (
                    <Pressable
                      key={emoji}
                      onPress={() => onReact(emoji)}
                      disabled={disabled}
                      accessibilityRole="button"
                      accessibilityLabel={selected ? `${emoji}, remove reaction` : `${emoji}, add reaction`}
                      accessibilityState={{ disabled, selected }}
                      style={({ pressed }) => [styles.emojiButton, { backgroundColor: selected || (pressed && !disabled) ? c.bg.pressed : 'transparent', opacity: disabled ? 0.42 : 1 }]}
                    >
                      <Text style={styles.emoji}>{emoji}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => setShowAllReactions((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel={showAllReactions ? 'Show fewer reactions' : 'More reactions'}
                  style={({ pressed }) => [styles.moreReactions, { backgroundColor: pressed ? c.bg.pressed : c.bg.surface }]}
                >
                  <Text style={[textStyle(theme.typeTokens.heading2), { color: c.text.primary }]}>{showAllReactions ? '−' : '+'}</Text>
                </Pressable>
              </ScrollView>
              <View style={[styles.previewBubble, { backgroundColor: own ? c.bubble.outgoing : c.bubble.incoming, borderRadius: theme.radius.bubble }]}>
                {!own && item.senderName ? <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.text.secondary }]}>{item.senderName}</Text> : null}
                <Text style={[textStyle(theme.typeTokens.bodyLg), { color: own ? c.bubble.outgoingText : c.bubble.incomingText }]} numberOfLines={4}>{preview}</Text>
                {item.editedAt && !deleted ? <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.muted }]}>{strings.chat.edited}</Text> : null}
              </View>
            </View>

            <View style={[styles.quickBar, { backgroundColor: c.bg.elevated, borderTopColor: c.separator, elevation: theme.elevation[3].android }]} accessibilityRole="toolbar" accessibilityLabel="Message quick actions">
              <QuickAction label={strings.chat.reply} iconName="action.reply" onPress={onReply} />
              <QuickAction label={strings.chat.copy} iconName="action.copy" onPress={onCopy} disabled={!hasText} />
              <QuickAction label={strings.chat.delete} iconName="action.delete" onPress={onDelete} disabled={!canEditOrDelete || failed} destructive />
              <QuickAction label={strings.chat.more} iconName="nav.more" onPress={() => setMoreVisible(true)} />
            </View>
          </View>
        ) : (
          <View style={styles.moreLayout} pointerEvents="box-none">
            <Animated.View style={[styles.moreCard, { backgroundColor: c.bg.elevated, borderRadius: theme.radius.xl, elevation: theme.elevation[3].android, opacity: sheetOpacity, transform: [{ translateY: sheetY }] }]} accessibilityRole="menu" accessibilityLabel="More message actions">
              <Text style={[textStyle(theme.typeTokens.heading1), styles.moreTitle, { color: c.text.primary }]}>{strings.chat.more}</Text>
              <MoreAction label={pinned ? strings.chat.unpin : strings.chat.pin} iconName={pinned ? 'action.unpin' : 'action.pin'} onPress={() => { closeMore(); onPin?.(); }} disabled={!canPin} />
              <MoreAction label={strings.chat.edit} iconName="action.edit" onPress={() => { closeMore(); onEdit(); }} disabled={!canEditOrDelete} />
              <MoreAction label={strings.chat.forward} iconName="action.forward" onPress={() => { closeMore(); onForward(); }} disabled={!hasText} />
              {failed ? <MoreAction label={strings.chat.retry} iconName="action.retry" onPress={() => { closeMore(); onRetry(); }} /> : null}
              {failed ? <MoreAction label={strings.chat.discard} iconName="action.discard" onPress={() => { closeMore(); onDiscard(); }} disabled={discardDisabled} destructive /> : null}
            </Animated.View>
          </View>
        )}
      </View>
      <ToastModalHost visible={visible} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  focusLayout: { flex: 1, justifyContent: 'flex-end' },
  selectedArea: { paddingHorizontal: 12, paddingBottom: 12, maxWidth: '100%', gap: 8 },
  alignEnd: { alignItems: 'flex-end' },
  alignStart: { alignItems: 'flex-start' },
  reactionScroller: { maxWidth: '100%', borderRadius: 26, borderWidth: 1 },
  reactionScroll: { minHeight: 52, alignItems: 'center', paddingHorizontal: 6, gap: 2 },
  emojiButton: { width: 42, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 27 },
  moreReactions: { width: 42, height: 42, marginHorizontal: 2, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  previewBubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10 },
  quickBar: { minHeight: 92, borderTopWidth: 1, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'stretch' },
  quickAction: { flex: 1, minHeight: 72, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 5 },
  moreLayout: { flex: 1, justifyContent: 'flex-end', padding: 16, paddingBottom: 28 },
  moreCard: { width: '100%', paddingVertical: 10, overflow: 'hidden' },
  moreTitle: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  moreAction: { minHeight: 56, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
});
