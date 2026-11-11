/**
 * CMP-09: chat list row (AND-03, AND-04) and its loading skeleton (CMP-18).
 *
 * Height 72, a 56 avatar, then the name with the mute icon and the preview with the status icon,
 * the " · " separator and the time. Unread rows use the bold name and primary-coloured preview
 * with the unread badge at the right (12.4, D-92, D-94).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChatListItem } from '@dologram/shared';
import { strings } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Icon } from './Icon';

export interface ChatRowProps {
  item: ChatListItem;
  onPress: (chatId: string) => void;
  onLongPress?: (item: ChatListItem) => void;
  /** Reserve more width for the timestamp on compact folder lists. */
  compactPreview?: boolean;
}

const ChatRow = React.memo(function ChatRow({ item, onPress, onLongPress, compactPreview = false }: ChatRowProps) {
  const theme = useTheme();
  const c = theme.colors;
  const unread = item.unreadCount > 0;

  const nameStyle = textStyle(
    unread ? { ...theme.typeTokens.titleSm, weight: 700 } : theme.typeTokens.titleSm,
  );
  const previewStyle = textStyle(
    unread ? { ...theme.typeTokens.bodyMd, weight: 600 } : theme.typeTokens.bodyMd,
  );
  const previewColor = unread ? c.text.primary : c.text.secondary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? c.bg.pressed : c.bg.app },
      ]}
      onPress={() => onPress(item.chatId)}
      onLongPress={onLongPress ? () => onLongPress(item) : undefined}
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel}
      accessibilityHint={onLongPress ? 'Long press for chat actions' : undefined}
    >
      <Avatar
        id={item.avatarId}
        displayName={item.avatarName}
        size={56}
        isSavedMessages={item.savedMessages}
      />

      <View style={styles.body}>
        <View style={styles.nameLine}>
          <View style={styles.nameContent}>
            <Text style={[nameStyle, styles.title, { color: c.text.primary }]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.muted ? (
              <Icon name="action.mute" size="sm" color={c.text.secondary} />
            ) : null}
          </View>
          {item.pinned ? <Icon name="action.star" size="sm" color={c.text.secondary} /> : null}
        </View>

        <View style={styles.previewLine}>
          <View style={styles.previewContent}>
            {item.ownStatus !== null ? (
              <Icon
                name={item.ownStatus === 'seen' ? 'status.seen' : 'status.sent'}
                size="sm"
                color={c.text.secondary}
              />
            ) : null}
            <Text
              style={[previewStyle, styles.preview, compactPreview && styles.compactPreview, { color: previewColor }]}
              numberOfLines={1}
            >
              {item.preview}
            </Text>
            {item.timeLabel.length > 0 ? (
              <Text style={[previewStyle, { color: previewColor }]} numberOfLines={1}>
                {`${item.preview.trim() ? ' · ' : ''}${item.timeLabel}`}
              </Text>
            ) : null}
          </View>
          {unread ? <Badge count={item.unreadCount} muted={item.muted} /> : null}
        </View>
      </View>
    </Pressable>
  );
}, (previous, next) => (
  previous.onPress === next.onPress
  && previous.onLongPress === next.onLongPress
  && previous.compactPreview === next.compactPreview
  // Cache reads rebuild plain row objects, even when nothing visible changed.
  // Keep unchanged avatars, text and icons out of navigation-time commits.
  && (previous.item === next.item || (
    Object.keys(previous.item).length === Object.keys(next.item).length
    && (Object.keys(next.item) as (keyof ChatListItem)[])
      .every((key) => previous.item[key] === next.item[key])
  ))
));

export { ChatRow };

// ─── Archived (n) row (AND-03, CMP-09) ────────────────────────────────────────

export interface ArchivedRowProps {
  count: number;
  onPress: () => void;
}

export function ArchivedRow({ count, onPress }: ArchivedRowProps) {
  const theme = useTheme();
  const c = theme.colors;
  const label = strings.chatList.archivedRow(count);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? c.bg.pressed : c.bg.app },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.archiveCircle, { backgroundColor: c.bg.surface }]}>
        <Icon name="action.archive" size="lg" color={c.text.primary} />
      </View>
      <View style={styles.body}>
        <Text
          style={[textStyle(theme.typeTokens.titleSm), { color: c.text.primary }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The initial chat-list placeholder uses one native-driven animation for every row. Keeping the
 * animation at the list level avoids starting one timer and one loop per skeleton block, which
 * makes the first render lighter and keeps the transition stable on slower devices.
 */
export function ChatListSkeleton({ rows = 8 }: { rows?: number }) {
  const theme = useTheme();
  const c = theme.colors;
  const opacity = useRef(new Animated.Value(0.58)).current;

  useEffect(() => {
    if (theme.reduceMotion) {
      opacity.setValue(0.75);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.92,
          duration: theme.motion.duration.spinner,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.58,
          duration: theme.motion.duration.spinner,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, theme.motion.duration.spinner, theme.reduceMotion]);

  return (
    <Animated.View accessible accessibilityLabel="Loading" style={{ opacity }}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.row}>
          <View
            style={[styles.skeletonCircle, { backgroundColor: c.skeleton.base }]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <View style={[styles.body, styles.skeletonBody]} accessibilityElementsHidden>
            <View style={[styles.skeletonName, { backgroundColor: c.skeleton.base }]} />
            <View style={[styles.skeletonPreview, { backgroundColor: c.skeleton.base }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 2,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    flexShrink: 1,
  },
  previewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  preview: {
    flexShrink: 1,
  },
  compactPreview: {
    maxWidth: '58%',
  },
  archiveCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonBody: {
    gap: 8,
  },
  skeletonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  skeletonName: {
    width: '40%',
    height: 14,
    borderRadius: 4,
  },
  skeletonPreview: {
    width: '70%',
    height: 12,
    borderRadius: 4,
  },
});
