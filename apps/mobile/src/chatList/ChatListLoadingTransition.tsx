import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { config } from '@dologram/shared';
import { ChatListSkeleton } from '../components/ChatRow';
import { useTheme } from '../theme/ThemeProvider';

const FADE_MS = 250;
const MIN_PLACEHOLDER_MS = 200;

/** Keep the list mounted; only the first cache read gets a placeholder and a reveal. */
export function ChatListLoadingTransition({ loading, children }: {
  loading: boolean;
  children: React.ReactNode;
}) {
  const { reduceMotion, colors } = useTheme();
  const progress = useRef(new Animated.Value(loading ? 0 : 1)).current;
  const shownAt = useRef<number | null>(null);
  const [placeholder, setPlaceholder] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (loading) {
      progress.setValue(0);
      shownAt.current = null;
      timer = setTimeout(() => {
        shownAt.current = Date.now();
        setPlaceholder(true);
      }, config.ui.loadingDelayMs);
    } else {
      const reveal = () => {
        if (reduceMotion) {
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
      // A read completing just after the threshold must not flash a one-frame skeleton.
      const remaining = shownAt.current === null || reduceMotion
        ? 0 : Math.max(0, MIN_PLACEHOLDER_MS - (Date.now() - shownAt.current));
      timer = setTimeout(reveal, remaining);
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      animation?.stop();
    };
  }, [loading, progress, reduceMotion]);

  return (
    <View style={styles.region} accessibilityState={{ busy: loading }}>
      <Animated.View
        style={[styles.region, { opacity: placeholder ? (loading ? 0 : 1) : progress }]}
        pointerEvents={loading || placeholder ? 'none' : 'auto'}
        accessibilityElementsHidden={loading || placeholder}
        importantForAccessibility={loading || placeholder ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </Animated.View>
      {placeholder ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, {
            backgroundColor: colors.bg.app,
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          }]}
        >
          <ChatListSkeleton />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ region: { flex: 1, overflow: 'hidden' } });
