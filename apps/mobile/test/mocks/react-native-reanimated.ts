import React from 'react';
import { Easing as NativeEasing, View } from 'react-native';

/** Lightweight Jest substitute; production uses Reanimated's UI-thread runtime. */
export const Easing = NativeEasing;

export function useSharedValue<T>(initialValue: T) {
  const [value] = React.useState(() => ({ value: initialValue }));
  return value;
}

export function useAnimatedStyle<T>(factory: () => T): T {
  return factory();
}

export function withTiming<T>(value: T): T {
  return value;
}

export function cancelAnimation(): void {
  // No animation scheduler exists in the test renderer.
}

export function runOnJS<T extends (...args: any[]) => any>(callback: T): T {
  return callback;
}

const Animated = { View };
export default Animated;
