import React, { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, interpolateColor, useAnimatedProps, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { dologramLogoColors as ink } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { CHAT_LOADING_CYCLE_MS, loadingDot, loadingQuarter, quarterPath } from './loadingLogoTimeline';

const MovingPath = Animated.createAnimatedComponent(Path);
const MovingCircle = Animated.createAnimatedComponent(Circle);

/** Transparent vector artwork; only the shapes inside the D change. */
export function DoloGramLoadingLogo({ size = 128 }: { size?: number }) {
  const { reduceMotion } = useTheme();
  const time = useSharedValue(0);
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (focused && foreground && !reduceMotion) {
      time.value = 0;
      time.value = withRepeat(withTiming(CHAT_LOADING_CYCLE_MS, {
        duration: CHAT_LOADING_CYCLE_MS, easing: Easing.linear,
      }), -1, false);
    }
    return () => cancelAnimation(time);
  }, [focused, foreground, reduceMotion, time]);
  const quarter = useAnimatedProps(() => loadingQuarter(time.value));

  return (
    <Svg width={size} height={size} viewBox="0 0 500 500" accessible={false}>
      <Path fill={ink.outline} d="M174 40H326C414 40 472 100 472 184V236C472 322 415 380 330 380H230Q187 430 139 455Q131 459 133 448Q147 405 128 373C66 357 28 306 28 239V183C28 100 88 40 174 40Z" />
      <Path fill={ink.paper} d="M177 72H325C395 72 440 119 440 184V236C440 303 395 348 329 348H215L164 400Q160 373 150 347C93 335 60 294 60 238V184C60 118 107 72 177 72Z" />
      <Path fill={ink.letter} d="M162 98H257C324 98 373 147 373 208S324 318 257 318H162Q132 318 132 288V128Q132 98 162 98Z" />
      {reduceMotion ? <Path fill={ink.paper} d={quarterPath(140)} /> : (
        <>
          <MovingPath fill={ink.paper} animatedProps={quarter} />
          <LoadingDot time={time} index={0} />
          <LoadingDot time={time} index={1} />
          <LoadingDot time={time} index={2} />
        </>
      )}
    </Svg>
  );
}

function LoadingDot({ time, index }: { time: SharedValue<number>; index: number }) {
  const props = useAnimatedProps(() => {
    const dot = loadingDot(time.value, index);
    return {
      cx: dot.cx, cy: dot.cy, opacity: dot.opacity,
      fill: index === 0 ? interpolateColor(dot.paper, [0, 1], [ink.letter, ink.paper]) : ink.paper,
    };
  });
  return <MovingCircle r={22} animatedProps={props} />;
}
