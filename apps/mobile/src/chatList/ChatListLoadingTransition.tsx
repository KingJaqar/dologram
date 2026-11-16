import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { config } from '@dologram/shared';
import { DoloGramLoadingLogo } from './DoloGramLoadingLogo';
import { chatListLaunches } from './startupSnapshot';
import { useTheme } from '../theme/ThemeProvider';

const FADE_MS = 250;
const MIN_PLACEHOLDER_MS = 200;
const LAUNCH_LOADING_MS = 600;

/** Keep rows mounted; show the logo on launch or a real uncached load, then crossfade. */
export function ChatListLoadingTransition({ loading, launchKey, children }: {
  loading: boolean;
  launchKey?: string;
  children: React.ReactNode;
}) {
  const { reduceMotion, colors } = useTheme();
  const [launchLoading, setLaunchLoading] = useState(() => Boolean(launchKey && !chatListLaunches.has(launchKey)));
  const waiting = loading || launchLoading;
  const progress = useRef(new Animated.Value(waiting ? 0 : 1)).current;
  const shownAt = useRef<number | null>(null);
  const [placeholder, setPlaceholder] = useState(launchLoading);

  useEffect(() => {
    if (!launchLoading) return;
    shownAt.current ??= Date.now();
    if (launchKey) chatListLaunches.add(launchKey);
    const timer = setTimeout(() => setLaunchLoading(false), reduceMotion ? 0 : LAUNCH_LOADING_MS);
    return () => clearTimeout(timer);
  }, [launchKey, launchLoading, reduceMotion]);

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (waiting) {
      progress.setValue(0);
      if (shownAt.current === null) {
        timer = setTimeout(() => {
          shownAt.current = Date.now();
          setPlaceholder(true);
        }, config.ui.loadingDelayMs);
      }
    } else {
      const reveal = () => {
        if (reduceMotion || shownAt.current === null) {
          progress.setValue(1);
          shownAt.current = null;
          setPlaceholder(false);
          return;
        }
        animation = Animated.timing(progress, {
          toValue: 1,
          duration: FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
          isInteraction: false,
        });
        animation.start(({ finished }) => {
          if (finished && !cancelled) {
            shownAt.current = null;
            setPlaceholder(false);
          }
        });
      };
      // A read completing just after the threshold must not flash a one-frame loader.
      const remaining = shownAt.current === null || reduceMotion
        ? 0 : Math.max(0, MIN_PLACEHOLDER_MS - (Date.now() - shownAt.current));
      if (remaining === 0) reveal();
      else timer = setTimeout(reveal, remaining);
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      animation?.stop();
    };
  }, [waiting, progress, reduceMotion]);

  return (
    <View style={styles.region} accessibilityState={{ busy: waiting }}>
      <Animated.View
        needsOffscreenAlphaCompositing
        style={[styles.region, { opacity: progress }]}
        pointerEvents={waiting || placeholder ? 'none' : 'auto'}
        accessibilityElementsHidden={waiting || placeholder}
        importantForAccessibility={waiting || placeholder ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </Animated.View>
      {placeholder ? (
        <Animated.View
          needsOffscreenAlphaCompositing
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.loader, {
            backgroundColor: colors.bg.app,
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          }]}
        >
          <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading chats" testID="chat-list-loader">
            <DoloGramLoadingLogo />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  region: { flex: 1, overflow: 'hidden' },
  loader: { alignItems: 'center', justifyContent: 'center' },
});
