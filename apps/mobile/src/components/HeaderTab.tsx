/**
 * Main-header navigation tab.
 *
 * The tab keeps its icon and label mounted and animates one progress value on
 * the UI thread. Width, opacity, surface and indicator all derive from that
 * value, so a route change can interrupt the transition without leaving a
 * stale label or mismatched active treatment behind.
 */
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';

export interface HeaderTabProps {
  label: string;
  active: boolean;
  onPress?: () => void;
  icon: React.ReactNode;
  /** Width of the icon-only state. */
  closedWidth?: number;
  /** Width of the label at the current header type scale. */
  labelWidth?: number;
  showLabel?: boolean;
  /** Width reserved for the icon, used to keep both states centered. */
  iconWidth?: number;
  accessibilityRole?: 'tab' | 'button';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: { selected?: boolean };
  onLongPress?: () => void;
  delayLongPress?: number;
}

const LABEL_GAP = 6;

export function HeaderTab({
  label,
  active,
  onPress,
  icon,
  closedWidth = 44,
  labelWidth = 48,
  showLabel = true,
  iconWidth = 20,
  accessibilityRole = 'tab',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  onLongPress,
  delayLongPress,
}: HeaderTabProps) {
  const theme = useTheme();
  const c = theme.colors;
  const progress = useSharedValue(active ? 1 : 0);
  const duration = theme.duration('normal');
  const labelSpace = showLabel ? labelWidth + LABEL_GAP : 0;

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(progress);
  }, [active, duration, progress]);

  const outerStyle = useAnimatedStyle(() => ({
    width: closedWidth + labelSpace * progress.value,
  }));
  const surfaceStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const labelStyle = useAnimatedStyle(() => ({
    width: labelSpace * progress.value,
    opacity: progress.value,
  }));
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <Animated.View style={[styles.outer, outerStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.activeSurface, { backgroundColor: c.bg.surface }, surfaceStyle]}
      />
      <Pressable
        style={({ pressed }) => [
          styles.tab,
          pressed ? { backgroundColor: c.bg.pressed } : null,
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={accessibilityState ?? { selected: active }}
      >
        <View style={[styles.icon, { width: iconWidth }]} pointerEvents="none">
          {icon}
        </View>
        <Animated.View pointerEvents="none" style={[styles.labelArea, labelStyle]}>
          <Text
            accessible={false}
            numberOfLines={1}
            style={[textStyle(theme.typeTokens.labelMd), styles.label, { color: c.text.primary, width: labelWidth }]}
          >
            {label}
          </Text>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.activeIndicator, { backgroundColor: c.brand.primary }, indicatorStyle]}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    height: 48,
    flexShrink: 0,
    borderRadius: 24,
    overflow: 'hidden',
  },
  activeSurface: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 24,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    overflow: 'hidden',
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  labelArea: {
    height: 24,
    overflow: 'hidden',
    flexShrink: 0,
  },
  label: {
    marginLeft: LABEL_GAP,
    includeFontPadding: false,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
});
