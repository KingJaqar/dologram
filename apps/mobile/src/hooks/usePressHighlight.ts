import { useCallback } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const PRESS_IN_DURATION = 220;
const PRESS_OUT_DURATION = 240;

/**
 * A lightweight centered press highlight for full-width rows.
 * The caller supplies the theme-aware background color to the animated layer.
 */
export function usePressHighlight(reduceMotion: boolean) {
  const progress = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleY: progress.value }],
  }));

  const setPressed = useCallback((pressed: boolean) => {
    progress.value = withTiming(pressed ? 1 : 0, {
      duration: reduceMotion ? 0 : pressed ? PRESS_IN_DURATION : PRESS_OUT_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reduceMotion]);

  const onPressIn = useCallback(() => setPressed(true), [setPressed]);
  const onPressOut = useCallback(() => setPressed(false), [setPressed]);

  return { style, onPressIn, onPressOut };
}
