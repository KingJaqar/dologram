import React, { createContext, useContext } from 'react';
import { Pressable, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, type CSSTransitionProperties } from 'react-native-reanimated';

const ReduceMotionContext = createContext(false);
export const ThemeMotionProvider = ReduceMotionContext.Provider;

export const THEME_TRANSITION_DURATION = 250;
// A responsive ease-out: colors react immediately, then settle gently without
// the sluggish tail of the CSS preset. It stays entirely on the UI thread.
export const THEME_TRANSITION_EASING = cubicBezier(0.2, 0, 0, 1);

const surfaceTransition: CSSTransitionProperties<ViewStyle> = {
  // Shadows are intentionally excluded: animating them is expensive and adds
  // no useful feedback during a palette change.
  transitionProperty: ['backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor'],
  transitionDuration: THEME_TRANSITION_DURATION,
  transitionTimingFunction: THEME_TRANSITION_EASING,
};
const textTransition: CSSTransitionProperties<TextStyle> = {
  transitionProperty: 'color',
  transitionDuration: THEME_TRANSITION_DURATION,
  transitionTimingFunction: THEME_TRANSITION_EASING,
};
const instantTransition = { transitionDuration: 0 };
const instantSurfaceTransition = { ...surfaceTransition, ...instantTransition };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Animate paint properties on the existing native views; never fade the UI away. */
export function ThemeSurface({ style, ...props }: ViewProps) {
  const reduceMotion = useContext(ReduceMotionContext);
  return <Animated.View {...props} style={[style, surfaceTransition, reduceMotion && instantTransition]} />;
}

export function ThemeText({ style, ...props }: TextProps) {
  const reduceMotion = useContext(ReduceMotionContext);
  return <Animated.Text {...props} style={[style, textTransition, reduceMotion && instantTransition]} />;
}

export function ThemePressable({ style, ...props }: PressableProps) {
  const reduceMotion = useContext(ReduceMotionContext);
  const transition = reduceMotion ? instantSurfaceTransition : surfaceTransition;
  const themedStyle = typeof style === 'function'
    ? (state: Parameters<typeof style>[0]) => [style(state), transition] as StyleProp<ViewStyle>
    : [style, transition];
  return <AnimatedPressable {...props} style={themedStyle} />;
}

export function themeColorTransition(reduceMotion: boolean) {
  return reduceMotion ? instantSurfaceTransition : surfaceTransition;
}
