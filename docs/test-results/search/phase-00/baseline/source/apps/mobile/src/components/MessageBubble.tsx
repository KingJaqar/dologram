/** CMP-07, CMP-08 and CMP-12: message bubble, reply quote and reactions. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { strings } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';
import { MessageText } from './MessageText';
import type { ChatMessageItem } from '../chat/query';
import type { ChatAttachment } from '../media/model';
import { AttachmentTile } from './AttachmentTile';

export type BubbleStatus = 'sent' | 'seen' | null;

export type ReplyPreview = { senderName: string; content: string; deleted: boolean };

export type MessageBubbleProps = {
  item: ChatMessageItem;
  own: boolean;
  userId: string;
  status: BubbleStatus;
  showTime: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
  onReactionPress?: (emoji: string) => void;
  reactionDisabled?: boolean;
  replyPreview?: ReplyPreview;
  onRetry?: () => void;
  onDiscard?: () => void;
  discardDisabled?: boolean;
  onAttachmentPress?: (attachment: ChatAttachment) => void;
  lowSignalActive?: boolean;
  pinned?: boolean;
  /** Optional per-chat outgoing bubble color selected in Chat Info > Customise. */
  accentColor?: string;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function statusLabel(item: ChatMessageItem, status: BubbleStatus, lowSignalActive: boolean): string | null {
  if (item.pending?.status === 'queued' && item.pending.last_error === 'waitingWifi') return strings.chat.labelWaitingWifi;
  if (item.pending?.status === 'queued' && item.pending.last_error === 'rateLimited') {
    return strings.queue.rateLimited(Math.max(1, Math.ceil((item.pending.next_attempt_at - Date.now()) / 1000)));
  }
  if (item.pending?.status === 'queued') return strings.chat.statusQueued;
  if (item.pending?.status === 'sending' && lowSignalActive) return strings.chat.labelLowSignal;
  if (item.pending?.status === 'sending') return strings.chat.statusSending;
  if (item.pending?.status === 'failed') return strings.chat.statusFailed;
  if (status === 'seen') return strings.chat.statusSeen;
  if (status === 'sent') return strings.chat.statusSent;
  return null;
}

function groupReactions(item: ChatMessageItem, userId: string): { emoji: string; count: number; own: boolean }[] {
  const grouped = new Map<string, { count: number; own: boolean }>();
  for (const reaction of item.reactions) {
    const current = grouped.get(reaction.emoji) ?? { count: 0, own: false };
    grouped.set(reaction.emoji, { count: current.count + 1, own: current.own || reaction.user_id === userId });
  }
  return [...grouped.entries()].map(([emoji, value]) => ({ emoji, ...value }));
}

export function MessageBubble({
  item,
  own,
  userId,
  status,
  showTime,
  onPress,
  onLongPress,
  onDoubleTap,
  onReactionPress,
  reactionDisabled = false,
  replyPreview,
  onRetry,
  onDiscard,
  discardDisabled = false,
  onAttachmentPress,
  lowSignalActive = false,
  pinned = false,
  accentColor,
}: MessageBubbleProps) {
  const theme = useTheme();
  const c = theme.colors;
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeAnimation = useRef(new Animated.Value(showTime ? 1 : 0)).current;
  const timeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const showTimeRef = useRef(showTime);
  const [timeMounted, setTimeMounted] = useState(showTime);
  const deleted = item.deletedAt !== null;
  const label = statusLabel(item, status, lowSignalActive);
  const editedLabel = item.editedAt && !deleted ? strings.chat.edited : null;
  const statusColor = item.pending?.status === 'failed' ? c.error.text : c.text.muted;
  const contentColor = own ? c.bubble.outgoingText : c.bubble.incomingText;
  const timestampStyle = {
    opacity: timeAnimation,
    transform: [{ translateX: timeAnimation.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
  };
  const statusIconName = item.pending?.status === 'failed'
    ? 'status.failed'
    : status === 'seen'
      ? 'status.seen'
      : item.pending?.status === 'sending'
        ? 'status.sending'
        : item.pending?.status === 'queued'
          ? 'status.queued'
          : 'status.sent';
  const reactions = useMemo(() => groupReactions(item, userId), [item, userId]);

  showTimeRef.current = showTime;

  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current); }, []);

  useEffect(() => {
    timeAnimationRef.current?.stop();
    const mountFrame = showTime ? requestAnimationFrame(() => setTimeMounted(true)) : null;

    const animation = Animated.timing(timeAnimation, {
      toValue: showTime ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    timeAnimationRef.current = animation;
    animation.start(({ finished }) => {
      if (finished && !showTimeRef.current) setTimeMounted(false);
      if (timeAnimationRef.current === animation) timeAnimationRef.current = null;
    });

    return () => {
      if (mountFrame !== null) cancelAnimationFrame(mountFrame);
      animation.stop();
      if (timeAnimationRef.current === animation) timeAnimationRef.current = null;
    };
  }, [showTime, timeAnimation]);

  const handlePress = () => {
    if (!onDoubleTap) { onPress(); return; }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onDoubleTap();
      return;
    }
    tapTimer.current = setTimeout(() => { tapTimer.current = null; onPress(); }, 220);
  };

  return (
    <View style={[styles.row, own ? styles.ownRow : styles.receivedRow]}>
      <View style={styles.bubbleRow}>
        {pinned && !deleted ? <View style={styles.pinnedIcon}><Icon name="action.pin" size="xs" color={c.text.muted} accessibilityLabel="" /></View> : null}
        <Pressable
          onPress={handlePress}
          onLongPress={onLongPress}
          delayLongPress={400}
          style={({ pressed }) => [styles.bubble, { backgroundColor: own ? (accentColor ?? c.bubble.outgoing) : c.bubble.incoming, borderRadius: theme.radius.bubble, opacity: pressed ? 0.86 : 1, maxWidth: '78%' }]}
          accessibilityRole="button"
          accessibilityLabel={`${own ? 'You' : item.senderName}, ${deleted ? strings.chat.deletedMessage : item.content}${item.editedAt ? `, ${strings.chat.edited}` : ''}${pinned ? `, ${strings.chat.pinned}` : ''}${label ? `, ${label}` : ', sent'}`}
        >
          {!own && item.senderName ? <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.text.secondary }]}>{item.senderName}</Text> : null}
          {replyPreview ? (
            <View style={[styles.replyQuote, { borderLeftColor: own ? c.bubble.outgoingText : c.brand.primary, backgroundColor: own ? c.bubble.join : c.bg.surface }]}>
              <Text style={[textStyle(theme.typeTokens.labelMd), { color: contentColor }]} numberOfLines={1}>{replyPreview.senderName}</Text>
              <Text style={[textStyle(theme.typeTokens.bodySm), { color: contentColor }]} numberOfLines={1}>{replyPreview.deleted ? strings.chat.deletedMessage : replyPreview.content}</Text>
            </View>
          ) : null}
          {deleted ? (
            <View style={styles.deletedRow}><Icon name="chat.deleted" size="xs" color={contentColor} accessibilityLabel="" /><Text style={[textStyle(theme.typeTokens.bodyMd), styles.deleted, { color: contentColor }]}>{strings.chat.deletedMessage}</Text></View>
          ) : item.content ? <MessageText content={item.content} color={contentColor} /> : null}
          {!deleted ? item.attachments.map((attachment, index) => (
            <AttachmentTile
              key={attachment.mediaId}
              attachment={attachment}
              index={index}
              total={item.attachmentCount}
              pending={item.pending?.status === 'sending' && Boolean(attachment.localUri)}
              onOpen={() => onAttachmentPress?.(attachment)}
            />
          )) : null}
          {!deleted ? Array.from({ length: Math.max(0, item.attachmentCount - item.attachments.length) }, (_, index) => <View key={`upload-${index}`} style={[styles.attachment, { backgroundColor: own ? c.bubble.join : c.bg.surface }]} accessibilityLabel={`${strings.media.waitingUpload}, ${item.attachments.length + index + 1} of ${item.attachmentCount}`}><Icon name="action.file" size="md" color={contentColor} accessibilityLabel="" /><Text style={[textStyle(theme.typeTokens.bodySm), { color: contentColor }]}>{strings.media.waitingUpload}</Text></View>) : null}
          {reactions.length > 0 ? (
            <View style={styles.reactions}>
              {reactions.map((reaction) => (
                <Pressable hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} key={reaction.emoji} onPress={() => onReactionPress?.(reaction.emoji)} disabled={reactionDisabled || !onReactionPress} accessibilityRole="button" accessibilityLabel={`${reaction.emoji}, ${reaction.count} reactions${reaction.own ? ', you reacted' : ''}`} accessibilityState={{ disabled: reactionDisabled || !onReactionPress, selected: reaction.own }} style={({ pressed }) => [styles.reaction, { backgroundColor: reaction.own ? c.bg.pressed : c.bg.surface, borderColor: reaction.own ? c.brand.primary : c.separator, opacity: reactionDisabled ? 0.5 : pressed ? 0.75 : 1 }]}>
                  <Text style={{ color: c.text.primary }}>{reaction.emoji}</Text><Text style={[textStyle(theme.typeTokens.labelMd), { color: reaction.own ? c.brand.primary : c.text.primary }]}>{reaction.count}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {!own && timeMounted ? <Animated.Text style={[textStyle(theme.typeTokens.bodySm), styles.timestamp, { color: c.text.muted }, timestampStyle]}>{formatTime(item.createdAt)}</Animated.Text> : null}
        </Pressable>
      </View>
      {own && (editedLabel || label || timeMounted) ? (
        <View style={styles.statusRow}>
          {editedLabel ? <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.text.muted }]}>{editedLabel}</Text> : null}
          {label ? <><Icon name={statusIconName} size="xs" color={statusColor} accessibilityLabel="" /><Text style={[textStyle(theme.typeTokens.labelMd), { color: statusColor }]}>{label}</Text></> : null}
          {timeMounted ? <Animated.Text style={[textStyle(theme.typeTokens.labelMd), styles.timestamp, { color: c.text.muted }, timestampStyle]}>{formatTime(item.createdAt)}</Animated.Text> : null}
        </View>
      ) : null}
      {own && item.pending?.status === 'failed' ? <View style={styles.retryRow}><Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry"><Text style={[textStyle(theme.typeTokens.labelMd), { color: c.brand.primary }]}>Retry</Text></Pressable><Pressable onPress={onDiscard} disabled={discardDisabled} accessibilityRole="button" accessibilityLabel="Discard" accessibilityState={{ disabled: discardDisabled }}><Text style={[textStyle(theme.typeTokens.labelMd), { color: c.error.text, opacity: discardDisabled ? 0.5 : 1 }]}>Discard</Text></Pressable></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', paddingHorizontal: 12, marginVertical: 3 },
  ownRow: { alignItems: 'flex-end' },
  receivedRow: { alignItems: 'flex-start' },
  bubbleRow: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
  pinnedIcon: { width: 20, alignItems: 'center', marginRight: 4 },
  bubble: { paddingHorizontal: 12, paddingVertical: 8 },
  deleted: { fontStyle: 'italic' },
  deletedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyQuote: { borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 4, marginBottom: 6, borderRadius: 4 },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, marginTop: 6, borderRadius: 8 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reaction: { minHeight: 28, paddingHorizontal: 8, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, marginRight: 4 },
  timestamp: { marginLeft: 2 },
  retryRow: { flexDirection: 'row', gap: 16, marginTop: 2, marginRight: 4 },
});
