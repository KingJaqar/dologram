/**
 * CMP-22: DateSeparator, UnreadDivider and JumpToBottom.
 * 12.5, D-95
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';

// ─── DateSeparator ────────────────────────────────────────────────────────────

export function DateSeparator({ label }: { label: string }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.dateRow, { marginVertical: theme.space[2] }]}>
      <View style={[styles.dateLine, { backgroundColor: c.separator }]} />
      <Text
        style={[
          textStyle(theme.typeTokens.labelMd),
          { color: c.text.muted, paddingHorizontal: theme.space[3] },
        ]}
        maxFontSizeMultiplier={1.5}
        accessibilityRole="header"
      >
        {label}
      </Text>
      <View style={[styles.dateLine, { backgroundColor: c.separator }]} />
    </View>
  );
}

// ─── UnreadDivider ────────────────────────────────────────────────────────────

export function UnreadDivider() {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      style={[
        styles.unreadRow,
        { backgroundColor: c.info.bg, paddingVertical: theme.space[1], paddingHorizontal: theme.space[4] },
      ]}
      accessibilityRole="header"
      accessibilityLabel="Unread messages below"
    >
      <Text
        style={[textStyle(theme.typeTokens.labelMd), { color: c.info.text }]}
        maxFontSizeMultiplier={1.5}
      >
        Unread messages
      </Text>
    </View>
  );
}

// ─── JumpToBottom ─────────────────────────────────────────────────────────────

export function JumpToBottom({ onPress, unreadCount }: { onPress: () => void; unreadCount?: number }) {
  const theme = useTheme();
  const c = theme.colors;
  const label = unreadCount ? `${unreadCount} new messages, jump to bottom` : 'Jump to bottom';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.jumpBtn,
        {
          shadowColor: c.shadow,
          backgroundColor: pressed ? c.brand.pressed : c.brand.primary,
          borderRadius: theme.radius.full,
          padding: theme.space[3],
          elevation: theme.elevation[2].android,
        },
      ]}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Icon name="ui.jumpToBottom" size="md" color={c.text.inverse} accessibilityLabel="" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  dateLine: { flex: 1, height: StyleSheet.hairlineWidth },
  unreadRow: { alignItems: 'center' },
  // shadowColor uses theme.colors.shadow applied inline in JumpToBottom
  jumpBtn: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
});
