/** Main-header navigation tab. */
import React, { useLayoutEffect, useRef } from 'react';
import { I18nManager, Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { themeColorTransition, ThemeSurface, ThemeText as Text } from '../theme/ThemeSurface';
import { textStyle } from '../theme/typography';

export interface HeaderTabProps {
  label: string;
  section: HeaderSection;
  selection: SharedValue<number[]>;
  active: boolean;
  onPress?: () => void;
  icon: React.ReactNode;
  /** Width of the icon-only state. */
  closedWidth?: number;
  compact?: boolean;
  /** Width reserved for the icon, used to keep both states centered. */
  iconWidth?: number;
  compactIconScale?: number;
  accessibilityRole?: 'tab' | 'button';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: { selected?: boolean };
  onLongPress?: () => void;
  delayLongPress?: number;
}

const SECTIONS = ['chats', 'folders', 'archive', 'ignored', 'settings'] as const;
export type HeaderSection = typeof SECTIONS[number];
const SELECTION_DURATION = 250;
export const HEADER_CONTROL_WIDTH = 44;
export const COMPACT_ACTIVE_TAB_WIDTH = 56;
export const WIDE_ACTIVE_TAB_WIDTH = 94;

export function useHeaderSelection(activeSection: HeaderSection, reduceMotion: boolean) {
  const target = SECTIONS.map((section) => Number(section === activeSection));
  const selection = useSharedValue(target);
  const lastSection = useRef(activeSection);

  useLayoutEffect(() => {
    if (!reduceMotion && lastSection.current === activeSection) return;
    lastSection.current = activeSection;
    const next = SECTIONS.map((section) => Number(section === activeSection));
    // All tabs transfer the same extra width on the same UI-thread timeline.
    // Retarget from the current widths if another route becomes active mid-transition.
    selection.set(reduceMotion ? next : withTiming(next, {
      duration: SELECTION_DURATION,
      easing: Easing.out(Easing.cubic),
    }));
  }, [activeSection, reduceMotion, selection]);

  return selection;
}

export function HeaderTab({
  label,
  section,
  selection,
  active,
  onPress,
  icon,
  closedWidth = HEADER_CONTROL_WIDTH,
  compact = false,
  iconWidth = 20,
  compactIconScale = 1,
  accessibilityRole = 'tab',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  onLongPress,
  delayLongPress,
}: HeaderTabProps) {
  const theme = useTheme();
  const c = theme.colors;
  const activeWidth = compact ? COMPACT_ACTIVE_TAB_WIDTH : WIDE_ACTIVE_TAB_WIDTH;
  const sectionIndex = SECTIONS.indexOf(section);
  const iconInset = 5;
  const labelStart = iconWidth + iconInset + 5;
  const direction = I18nManager.isRTL ? -1 : 1;
  const frameStyle = useAnimatedStyle(() => ({
    width: closedWidth + (activeWidth - closedWidth) * selection.value[sectionIndex],
  }));
  const iconStyle = useAnimatedStyle(() => {
    const progress = selection.value[sectionIndex];
    return {
      transform: [
        { translateX: compact ? 0 : (iconInset + (iconWidth - activeWidth) / 2) * direction * progress },
        { translateY: compact ? -11 * progress : 0 },
        { scale: compact ? 1 + (compactIconScale - 1) * progress : 1 },
      ],
    };
  });
  const surfaceStyle = useAnimatedStyle(() => ({ opacity: selection.value[sectionIndex] }));
  const decorationStyle = useAnimatedStyle(() => ({
    // Reveal the label once the expanding tab has room to draw it.
    opacity: Math.max(0, (selection.value[sectionIndex] - 0.65) / 0.35),
  }));

  return (
    <Animated.View
      testID={`header-tab-frame-${section}`}
      style={[styles.frame, compact && styles.compactFrame, frameStyle]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.surface, { backgroundColor: c.bg.surface }, surfaceStyle, themeColorTransition(theme.reduceMotion)]}
      />
      <Pressable
        style={({ pressed }) => [StyleSheet.absoluteFill, styles.tab, pressed && { backgroundColor: c.bg.pressed }]}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={accessibilityState ?? { selected: active }}
      >
        <Animated.View style={[styles.icon, iconStyle]} pointerEvents="none">
          {icon}
        </Animated.View>
        {/* Keep the label and indicator mounted so an interrupted route change can fade
            between states without a JS-thread unmount/remount flicker. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.decoration, decorationStyle]}>
          <Text
            accessible={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              textStyle(theme.typeTokens.labelMd),
              styles.label,
              compact
                ? [styles.compactLabel, { width: activeWidth - 8 }]
                : { start: labelStart, width: activeWidth - labelStart - 4 },
              { color: c.text.primary },
            ]}
          >
            {label}
          </Text>
          <ThemeSurface style={[styles.activeIndicator, { backgroundColor: c.brand.primary }]} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 48,
    flexShrink: 0,
  },
  compactFrame: {
    height: 52,
  },
  surface: {
    borderRadius: 24,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  decoration: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    position: 'absolute',
    includeFontPadding: false,
  },
  compactLabel: {
    bottom: 6,
    textAlign: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
});
