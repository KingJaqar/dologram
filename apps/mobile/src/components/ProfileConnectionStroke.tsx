import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

const DURATION_MS = 3000;
const CIRCUMFERENCE = 2 * Math.PI * 14;

/** One UI-thread revolution per color change, with no timers or animation loop. */
export function ProfileConnectionStroke({ color, children }: {
  color: string;
  children: React.ReactNode;
}) {
  const { reduceMotion } = useTheme();
  const previousColor = useRef(color);
  const displayedColor = useSharedValue(color);
  const progress = useSharedValue(1);

  useLayoutEffect(() => {
    if (reduceMotion) {
      cancelAnimation(displayedColor);
      cancelAnimation(progress);
      displayedColor.set(color);
      progress.set(1);
    } else if (previousColor.current !== color) {
      // Retarget the existing color animation from its current visible color.
      displayedColor.set(withTiming(color, { duration: DURATION_MS, easing: Easing.linear }));
      cancelAnimation(progress);
      progress.set(0);
      progress.set(withTiming(1, { duration: DURATION_MS, easing: Easing.linear }));
    }
    previousColor.current = color;
  }, [color, reduceMotion, displayedColor, progress]);

  useEffect(() => () => {
    cancelAnimation(displayedColor);
    cancelAnimation(progress);
  }, [displayedColor, progress]);

  const ringStyle = useAnimatedStyle(() => ({ borderColor: displayedColor.value }));
  const rollStyle = useAnimatedStyle(() => ({
    // Hide both ends of the revolution so rapid updates never flash a reset arc.
    opacity: Math.min(1, progress.value * 10, (1 - progress.value) * 10),
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  return (
    <View testID="profile-connection-stroke" style={styles.frame}>
      <Animated.View pointerEvents="none" testID="profile-connection-ring" style={[StyleSheet.absoluteFill, styles.ring, ringStyle]} />
      <Animated.View pointerEvents="none" testID="profile-connection-roll" style={[StyleSheet.absoluteFill, rollStyle]}>
        <Svg width={30} height={30} viewBox="0 0 30 30">
          <Circle testID="profile-connection-arc" cx={15} cy={15} r={14}
            fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"
            strokeDasharray={[CIRCUMFERENCE / 4, CIRCUMFERENCE * 3 / 4]}
            rotation={-90} origin="15, 15" />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 30, height: 30, padding: 3 },
  ring: { borderRadius: 15, borderWidth: 2 },
});
