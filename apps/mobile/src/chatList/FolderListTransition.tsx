import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { ChatListItem } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';

type Snapshot = { folderId: string | null; items: ChatListItem[] };
type Props = Snapshot & { renderList: (items: ChatListItem[]) => React.ReactNode };

/** Retain the outgoing list while the next folder fades in; never queue folder taps. */
export function FolderListTransition({ folderId, items, renderList }: Props) {
  const { reduceMotion } = useTheme();
  const [state, setState] = useState<{ current: Snapshot; previous: Snapshot | null }>(() => ({
    current: { folderId, items }, previous: null,
  }));

  if (state.current.folderId !== folderId) {
    setState({ current: { folderId, items }, previous: reduceMotion ? null : state.current });
  } else if (state.current.items !== items) {
    // Live message updates do not replay the folder-switch animation.
    setState({ ...state, current: { folderId, items } });
  }

  const finish = useCallback((completedFolderId: string | null) => {
    setState((current) => current.current.folderId === completedFolderId && current.previous
      ? { ...current, previous: null } : current);
  }, []);

  return (
    <View style={styles.region}>
      {[...(state.previous ? [state.previous] : []), state.current].map((snapshot) => (
        <FolderScene
          key={snapshot.folderId === null ? 'all' : `folder:${snapshot.folderId}`}
          folderId={snapshot.folderId}
          active={snapshot === state.current}
          entering={state.previous !== null}
          reduceMotion={reduceMotion}
          onFinish={finish}
        >
          {renderList(snapshot.items)}
        </FolderScene>
      ))}
    </View>
  );
}

function FolderScene({ folderId, active, entering, reduceMotion, onFinish, children }: {
  folderId: string | null;
  active: boolean;
  entering: boolean;
  reduceMotion: boolean;
  onFinish: (folderId: string | null) => void;
  children: React.ReactNode;
}) {
  // New folders begin transparent before their first frame. A retained folder
  // reverses its existing fade if the user taps back before it completes.
  const opacity = useRef(new Animated.Value(active && entering && !reduceMotion ? 0 : 1)).current;
  useLayoutEffect(() => {
    let cancelled = false;
    const animation = Animated.timing(opacity, {
      toValue: active ? 1 : 0,
      duration: reduceMotion ? 0 : 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished && !cancelled && active) onFinish(folderId);
    });
    return () => { cancelled = true; animation.stop(); };
  }, [active, folderId, onFinish, opacity, reduceMotion]);

  return (
    <Animated.View
      style={[active ? styles.region : StyleSheet.absoluteFill, { opacity }]}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ region: { flex: 1, overflow: 'hidden' } });
