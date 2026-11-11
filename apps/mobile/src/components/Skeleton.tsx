/**
 * CMP-18: Skeleton placeholder — appears only after motion.delay.loading,
 * shimmer stops under reduceMotion.
 * 12.5, D-95
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius, style }: SkeletonProps) {
  const theme = useTheme();
  const c = theme.colors;

  const [visible, setVisible] = useState(false);
  const shimmerRef = useRef<Animated.Value | null>(null);
  if (shimmerRef.current === null) {
    shimmerRef.current = new Animated.Value(0);
  }
  const shimmer = shimmerRef.current;
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delay appearance by motion.delay.loading
  useEffect(() => {
    delayTimer.current = setTimeout(
      () => setVisible(true),
      theme.motion.delay.loading,
    );
    return () => {
      if (delayTimer.current) clearTimeout(delayTimer.current);
    };
  }, [theme.motion.delay.loading]);

  // Shimmer animation
  useEffect(() => {
    if (!visible || theme.reduceMotion) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: theme.motion.duration.spinner, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: theme.motion.duration.spinner, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [visible, theme.reduceMotion, shimmer, theme.motion.duration.spinner]);

  if (!visible) return null;

  const opacity = theme.reduceMotion
    ? 1
    : shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: borderRadius ?? theme.radius.sm,
          backgroundColor: c.skeleton.base,
          opacity,
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

// ─── Skeleton Row helper ──────────────────────────────────────────────────────

export function SkeletonRow() {
  const theme = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3], padding: theme.space[4] }}
    >
      <Skeleton width={48} height={48} borderRadius={24} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="90%" height={12} />
      </View>
    </View>
  );
}
