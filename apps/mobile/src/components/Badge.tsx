/**
 * CMP-06: Unread count badge.
 * Variants: normal (brand) and muted.
 * Not focusable — its value is conveyed by the containing row's accessibilityLabel.
 * 12.3, D-95
 */
import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';

export interface BadgeProps {
  count: number;
  muted?: boolean;
}

export function Badge({ count, muted = false }: BadgeProps) {
  const theme = useTheme();
  const c = theme.colors;

  if (count <= 0) return null;

  const label = count > 999 ? '999+' : String(count);
  const minWidth = label.length === 1 ? 20 : label.length === 2 ? 24 : 28;

  const { bg, text } = muted ? c.badge.muted : c.badge.unread;

  return (
    <View
      style={{
        minWidth,
        height: 20,
        borderRadius: 10,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
      }}
      accessible={false}
      importantForAccessibility="no"
    >
      <Text
        style={[
          textStyle(theme.typeTokens.labelMd),
          { color: text, fontSize: 11, lineHeight: 14 },
        ]}
        maxFontSizeMultiplier={1}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
