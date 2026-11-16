import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { strings } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';

type Props = {
  accessibilityLabel?: string;
  busy?: boolean;
  message?: string;
  restoreLabel?: string;
  onUnignore: () => void;
  onBlock?: () => void;
  onDelete: () => void;
};

type Action = { label: string; onPress: () => void; destructive: boolean };

export function IgnoredChatActionBar({
  accessibilityLabel = strings.ignoredChat.actionsLabel,
  busy = false,
  message = strings.ignoredChat.message,
  restoreLabel = strings.ignoredChat.unignore,
  onUnignore,
  onBlock,
  onDelete,
}: Props) {
  const theme = useTheme();
  const actions: Action[] = [
    ...(onBlock ? [{ label: strings.ignoredChat.block, onPress: onBlock, destructive: true }] : []),
    { label: strings.ignoredChat.delete, onPress: onDelete, destructive: true },
    { label: restoreLabel, onPress: onUnignore, destructive: false },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg.surface,
          borderTopColor: theme.colors.separator,
          padding: theme.space[4],
          gap: theme.space[4],
        },
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[textStyle(theme.typeTokens.bodyMd), styles.message, { color: theme.colors.text.secondary }]}>
        {message}
      </Text>
      <View style={[styles.actions, { gap: theme.space[2] }]}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.button,
              {
                borderRadius: theme.radius.md,
                backgroundColor: pressed ? theme.colors.bg.pressed : theme.colors.bg.elevated,
                opacity: busy ? 0.5 : 1,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={[
                textStyle(theme.typeTokens.labelLg),
                { color: action.destructive ? theme.colors.error.text : theme.colors.brand.primary },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: StyleSheet.hairlineWidth },
  message: { textAlign: 'center' },
  actions: { flexDirection: 'row' },
  button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
