import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

const CROSSFADE_MS = 250;

type Snapshot = { viewKey: string; content: React.ReactNode };
/** Retain outgoing content long enough to fade it, including during rapid switches. */
export function ContentCrossfade({ viewKey, children }: {
  viewKey: string;
  children: React.ReactNode;
}) {
  const { reduceMotion } = useTheme();
  const [scenes, setScenes] = useState<Snapshot[]>(() => [{ viewKey, content: children }]);
  const current = scenes[scenes.length - 1];

  if (current.viewKey !== viewKey || current.content !== children || (reduceMotion && scenes.length > 1)) {
    // Reuse an incoming scene if it is still fading out. Its opacity can reverse in place.
    const outgoing = reduceMotion ? [] : scenes.filter((scene) => scene.viewKey !== viewKey);
    setScenes([...outgoing, { viewKey, content: children }]);
  }

  const removeOutgoing = useCallback((completedViewKey: string) => {
    setScenes((previous) => previous[previous.length - 1].viewKey === completedViewKey
      ? previous
      : previous.filter((scene) => scene.viewKey !== completedViewKey));
  }, []);

  return (
    <View style={styles.region}>
      {scenes.map((snapshot) => (
        <CrossfadeScene
          key={snapshot.viewKey}
          viewKey={snapshot.viewKey}
          active={snapshot === current}
          entering={scenes.length > 1}
          reduceMotion={reduceMotion}
          onFadeOut={removeOutgoing}
        >
          {snapshot.content}
        </CrossfadeScene>
      ))}
    </View>
  );
}

function CrossfadeScene({
  viewKey,
  active,
  entering,
  reduceMotion,
  onFadeOut,
  children,
}: {
  viewKey: string;
  active: boolean;
  entering: boolean;
  reduceMotion: boolean;
  onFadeOut: (viewKey: string) => void;
  children: React.ReactNode;
}) {
  const [opacity] = useState(() => new Animated.Value(entering && !reduceMotion ? 0 : 1));

  useLayoutEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    let cancelled = false;
    const animation = Animated.timing(opacity, {
      toValue: active ? 1 : 0,
      duration: CROSSFADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished && !cancelled && !active) onFadeOut(viewKey);
    });
    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [active, onFadeOut, opacity, reduceMotion, viewKey]);

  return (
    <Animated.View
      needsOffscreenAlphaCompositing
      style={[StyleSheet.absoluteFill, { opacity: reduceMotion ? 1 : opacity }]}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  region: { flex: 1, overflow: 'hidden' },
});
