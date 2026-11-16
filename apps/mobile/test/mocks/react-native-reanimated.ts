import React from 'react';
import { Easing as NativeEasing, Text, View } from 'react-native';

/** Lightweight Jest substitute; production uses Reanimated's UI-thread runtime. */
export const Easing = NativeEasing;

export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  return { name: 'cubic-bezier', x1, y1, x2, y2 };
}

export function useSharedValue<T>(initialValue: T) {
  const [value] = React.useState(() => ({
    value: initialValue,
    set(next: T) { this.value = next; },
  }));
  return value;
}

export function useAnimatedStyle<T>(factory: () => T): T {
  return factory();
}

export function withTiming<T>(value: T, _config?: unknown, callback?: (finished: boolean) => void): T {
  callback?.(true);
  return value;
}

export function withDelay<T>(_delayMs: number, animation: T): T {
  return animation;
}

export function withSpring<T>(value: T, _config?: unknown, callback?: (finished: boolean) => void): T {
  callback?.(true);
  return value;
}

export function cancelAnimation(): void {
  // No animation scheduler exists in the test renderer.
}

export function runOnJS<T extends (...args: any[]) => any>(callback: T): T {
  return callback;
}

export function createAnimatedComponent<T>(component: T): T { return component; }
const Animated = { Text, View, createAnimatedComponent };
export default Animated;
