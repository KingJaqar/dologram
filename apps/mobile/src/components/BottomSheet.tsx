/**
 * CMP-15: Bottom sheet — UI-thread animation, native pan gesture, scrim and
 * back-button close (12.6, D-95).
 *
 * The sheet deliberately stays mounted for the exit animation. Reanimated and
 * RNGH keep both the open/close transition and the drag interaction off the JS
 * thread, which prevents dropped frames when the sheet contains a large list.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ToastModalHost } from './Toast';
import { useTheme } from '../theme/ThemeProvider';

// Reanimated shared values are intentionally mutable, and mounted is updated
// by the animation lifecycle so the native Modal can finish its exit motion.
/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const HANDLE_HEIGHT = 4;
const HANDLE_VERTICAL_SPACE = 20;
const MAX_SHEET_RATIO = 0.9;
const TRANSITION_DURATION = 240;
const DRAG_THRESHOLD = 48;
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 900;

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function BottomSheet({
  visible,
  onClose,
  children,
  style,
}: BottomSheetProps) {
  const theme = useTheme();
  const c = theme.colors;
  const { height: windowHeight } = useWindowDimensions();
  const maxHeight = Math.max(1, windowHeight * MAX_SHEET_RATIO);
  const duration = theme.reduceMotion ? 0 : TRANSITION_DURATION;
  const [mounted, setMounted] = useState(visible);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const translateY = useSharedValue(maxHeight);
  const scrimOpacity = useSharedValue(0);
  const sheetHeight = useSharedValue(0);
  const collapsedHeight = useSharedValue(0);
  const expandedHeight = useSharedValue(maxHeight);
  const startHeight = useSharedValue(0);
  const startTranslateY = useSharedValue(0);

  const closeFromGesture = useCallback(() => {
    onCloseRef.current();
  }, []);

  const finishExit = useCallback(() => {
    setMounted(false);
  }, []);

  const transitionTiming = useCallback((toValue: number) => ({
    duration,
    easing: Easing.out(Easing.cubic),
  }), [duration]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value > 0 ? sheetHeight.value : undefined,
    transform: [{ translateY: translateY.value }],
  }));

  const scrimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  // Measure the natural content height once. This keeps the compact state
  // visually identical to the existing content-sized sheets, while still
  // giving every sheet an expanded snap point at 90% of the viewport.
  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    const naturalHeight = Math.ceil(event.nativeEvent.layout.height + HANDLE_VERTICAL_SPACE + HANDLE_HEIGHT);
    setContentHeight((previous) => previous === naturalHeight ? previous : naturalHeight);
  }, []);

  useEffect(() => {
    const nextCollapsedHeight = contentHeight === null
      ? 0
      : Math.min(Math.max(contentHeight, HANDLE_VERTICAL_SPACE + HANDLE_HEIGHT), maxHeight);

    collapsedHeight.value = nextCollapsedHeight;
    expandedHeight.value = maxHeight;

    if (sheetHeight.value === 0 || !visible) {
      sheetHeight.value = nextCollapsedHeight;
    } else {
      sheetHeight.value = clamp(sheetHeight.value, nextCollapsedHeight, maxHeight);
    }
  }, [contentHeight, expandedHeight, collapsedHeight, maxHeight, sheetHeight, visible]);

  // Open and close with the same 240 ms timing curve. The mounted flag is
  // intentionally delayed on close so the native Modal does not cut off the
  // slide-down transition.
  useEffect(() => {
    cancelAnimation(translateY);
    cancelAnimation(scrimOpacity);

    if (visible) {
      setMounted(true);
      translateY.value = maxHeight;
      scrimOpacity.value = 0;
      translateY.value = withTiming(0, transitionTiming(0));
      scrimOpacity.value = withTiming(1, transitionTiming(1));
    } else {
      translateY.value = withTiming(maxHeight, {
        ...transitionTiming(maxHeight),
        easing: Easing.in(Easing.cubic),
      }, (finished) => {
        if (finished) runOnJS(finishExit)();
      });
      scrimOpacity.value = withTiming(0, transitionTiming(0));
    }
  }, [duration, finishExit, maxHeight, scrimOpacity, transitionTiming, translateY, visible]);

  // Android back button: let the sheet close before the route handles back.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  const panGesture = useMemo(() => Gesture.Pan()
    .minDistance(4)
    .activeOffsetY([-8, 8])
    .failOffsetX([-32, 32])
    .onBegin(() => {
      cancelAnimation(sheetHeight);
      cancelAnimation(translateY);
      startHeight.value = sheetHeight.value;
      startTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      const nextHeight = startHeight.value - event.translationY;
      const nextCollapsed = collapsedHeight.value;
      const nextExpanded = expandedHeight.value;

      if (nextHeight >= nextCollapsed) {
        sheetHeight.value = clamp(nextHeight, nextCollapsed, nextExpanded);
        translateY.value = startTranslateY.value;
      } else {
        // Once compact, additional downward movement becomes a dismiss drag.
        sheetHeight.value = nextCollapsed;
        translateY.value = Math.max(0, event.translationY - (startHeight.value - nextCollapsed));
      }

      // Slightly relax the scrim as the sheet is pulled down, without doing a
      // React render for every pointer event.
      scrimOpacity.value = 1 - Math.min(0.24, (translateY.value / maxHeight) * 0.24);
    })
    .onEnd((event) => {
      const nextCollapsed = collapsedHeight.value;
      const nextExpanded = expandedHeight.value;
      const draggedPastCompact = Math.max(0, event.translationY - (startHeight.value - nextCollapsed));
      const atCompact = startHeight.value <= nextCollapsed + 1;
      const shouldDismiss = draggedPastCompact > DISMISS_DISTANCE ||
        (atCompact && event.translationY > 0 && event.velocityY > DISMISS_VELOCITY);

      if (shouldDismiss) {
        translateY.value = withTiming(maxHeight, {
          duration,
          easing: Easing.in(Easing.cubic),
        });
        scrimOpacity.value = withTiming(0, { duration });
        runOnJS(closeFromGesture)();
        return;
      }

      const midpoint = (nextCollapsed + nextExpanded) / 2;
      const targetHeight = event.velocityY < -DISMISS_VELOCITY || event.translationY < -DRAG_THRESHOLD
        ? nextExpanded
        : event.velocityY > DISMISS_VELOCITY || event.translationY > DRAG_THRESHOLD
          ? nextCollapsed
          : sheetHeight.value >= midpoint ? nextExpanded : nextCollapsed;

      sheetHeight.value = withTiming(targetHeight, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(0, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      scrimOpacity.value = withTiming(1, { duration });
    }), [closeFromGesture, collapsedHeight, duration, expandedHeight, maxHeight, scrimOpacity, sheetHeight, startHeight, startTranslateY, translateY]);

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, scrimAnimatedStyle]}
          pointerEvents="none"
        />
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          />
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheet,
                {
                  backgroundColor: c.bg.elevated,
                  borderTopLeftRadius: theme.radius.xl,
                  borderTopRightRadius: theme.radius.xl,
                  elevation: theme.elevation[3].android,
                  maxHeight,
                },
                sheetAnimatedStyle,
                style,
              ]}
            >
              <View style={styles.handleRow} pointerEvents="none">
                <View
                  style={[
                    styles.handle,
                    { backgroundColor: c.separator, borderRadius: HANDLE_HEIGHT / 2 },
                  ]}
                />
              </View>
              <View onLayout={handleContentLayout}>
                {children}
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
      {ToastModalHost ? <ToastModalHost visible={visible} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  sheet: {
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 32,
    height: HANDLE_HEIGHT,
  },
});
