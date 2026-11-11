/**
 * A person in a selectable checklist (AND-11 New group, AND-12 Add members).
 *
 * 48 avatar, the display name, and a checkbox at the right; row height 64 (12.5). The whole row is
 * one checkbox for screen readers, and a checkbox disabled by the D-58 limit says so.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

export interface ContactRowProps {
  userId: string;
  displayName: string;
  selected: boolean;
  /** True when the D-58 limit is reached and this row is not selected. */
  disabled?: boolean;
  onToggle: (userId: string) => void;
}

export function ContactRow({
  userId,
  displayName,
  selected,
  disabled = false,
  onToggle,
}: ContactRowProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed && !disabled ? c.bg.pressed : 'transparent', opacity: disabled ? 0.5 : 1 },
      ]}
      onPress={() => onToggle(userId)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={displayName}
      accessibilityState={{ checked: selected, disabled }}
    >
      <Avatar id={userId} displayName={displayName} size={48} />

      <Text style={[textStyle(theme.typeTokens.bodyLg), styles.name, { color: c.text.primary }]} numberOfLines={1}>
        {displayName}
      </Text>

      <View
        style={[
          styles.box,
          {
            borderColor: selected ? c.brand.primary : c.separator,
            backgroundColor: selected ? c.brand.primary : 'transparent',
            borderRadius: theme.radius.sm,
          },
        ]}
      >
        {selected ? <Icon name="admin.success" size="sm" color={c.text.inverse} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  name: { flex: 1 },
  box: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
