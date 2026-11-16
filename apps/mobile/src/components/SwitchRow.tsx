/**
 * CMP-04: Switch row — custom track/thumb, accessible.
 * Track: 48 × 28, thumb: 22 × 22, row min-height 56.
 * 12.5, D-95
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { ThemeText as Text, THEME_TRANSITION_DURATION, THEME_TRANSITION_EASING } from '../theme/ThemeSurface';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';

export interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  animationDuration?: number;
}

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - 3 * 2; // 3px padding each side

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  animationDuration,
}: SwitchRowProps) {
  const theme = useTheme();
  const c = theme.colors;
  const thumbDuration = animationDuration ?? THEME_TRANSITION_DURATION;

  return (
    <Pressable
      style={[
        styles.row,
        { minHeight: 56, opacity: disabled ? 0.5 : 1 },
      ]}
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
    >
      <View style={styles.labelArea}>
        <Text
          style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]}
        >
          {label}
        </Text>
        {description ? (
          <Text
            style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}
          >
            {description}
          </Text>
        ) : null}
      </View>

      {/* Track */}
      <Animated.View
        style={[
          styles.track,
          {
            // The light input background is too close to the ivory app surface
            // to make an off switch legible.
            backgroundColor: value
              ? c.brand.primary
              : theme.scheme === 'light'
                ? c.text.muted
                : c.bg.input,
            borderRadius: TRACK_HEIGHT / 2,
            transitionProperty: 'backgroundColor',
            transitionDuration: theme.reduceMotion ? 0 : thumbDuration,
            transitionTimingFunction: THEME_TRANSITION_EASING,
          },
        ]}
      >
        {/* Thumb */}
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX: value ? THUMB_TRAVEL : 0 }],
              transitionProperty: ['transform', 'backgroundColor'],
              transitionDuration: theme.reduceMotion ? 0 : thumbDuration,
              transitionTimingFunction: THEME_TRANSITION_EASING,
              backgroundColor: value || theme.scheme === 'light' ? c.bg.surface : c.text.inverse,
              shadowColor: c.shadow,
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  labelArea: { flex: 1, gap: 2 },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    // shadowColor is applied inline from theme.colors.shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 1,
  },
});
