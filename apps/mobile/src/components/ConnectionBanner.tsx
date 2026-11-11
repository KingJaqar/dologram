/**
 * CMP-13: connection banner and Low Signal chip (AND-03, D-12, D-13, D-19).
 *
 * The offline banner sits directly under the top bar of the chat list; the Low Signal chip sits at
 * the right of the chat list top bar while the Automatic row of LS-5 applies (a 2G or 3G cellular
 * connection). The "waiting for Wi-Fi" banner belongs to the LS-5 deferral of Phase 13, which owns
 * the deferred-item count.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { strings } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';

export function OfflineBanner() {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View
      style={[styles.banner, { backgroundColor: c.info.bg }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={strings.chatList.offlineBanner}
    >
      <Icon name="conn.offline" size="md" color={c.info.text} />
      <Text
        style={[textStyle(theme.typeTokens.bodySm), styles.bannerText, { color: c.info.text }]}
        maxFontSizeMultiplier={1.5}
      >
        {strings.chatList.offlineBanner}
      </Text>
    </View>
  );
}

export interface LowSignalChipProps {
  onPress: () => void;
}

export function LowSignalChip({ onPress }: LowSignalChipProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: c.warning.bg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      hitSlop={4}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={strings.chatList.lowSignal}
    >
      <Icon name="conn.lowSignal" size="sm" color={c.warning.text} />
      <Text
        style={[textStyle(theme.typeTokens.labelMd), { color: c.warning.text }]}
        maxFontSizeMultiplier={1.5}
      >
        {strings.chatList.lowSignal}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  bannerText: {
    flexShrink: 1,
  },
  chip: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
});
