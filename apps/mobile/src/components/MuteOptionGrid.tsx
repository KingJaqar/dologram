import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { strings, type MuteOptionId } from '@dologram/shared';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';

type Props = {
  disabled?: boolean;
  onSelect: (option: MuteOptionId) => void;
};

type MuteOption = readonly [MuteOptionId, string];

const OPTION_ROWS: readonly (readonly MuteOption[])[] = [
  [
    ['oneHour', strings.organization.oneHour],
    ['eightHours', strings.organization.eightHours],
  ],
  [
    ['oneWeek', strings.organization.oneWeek],
    ['untilUnmuted', strings.organization.untilUnmuted],
  ],
];

/** Compact, fixed-size mute choices so the sheet stays short and predictable. */
export function MuteOptionGrid({ disabled = false, onSelect }: Props) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.grid}>
      {OPTION_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map(([option, label]) => (
            <Pressable
              key={option}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: pressed && !disabled ? c.bg.pressed : 'transparent',
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
              onPress={() => onSelect(option)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ disabled }}
            >
              <View style={[styles.icon, { backgroundColor: c.bg.surface }]}>
                <Icon name="action.mute" size="md" color={c.text.primary} accessibilityLabel="" />
              </View>
              <Text style={[textStyle(theme.typeTokens.labelMd), styles.label, { color: c.text.primary }]} numberOfLines={2}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 8, paddingHorizontal: 12 },
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
});
