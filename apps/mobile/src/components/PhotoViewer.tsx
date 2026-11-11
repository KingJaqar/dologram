import React, { useMemo, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, View } from 'react-native';
import { strings } from '@dologram/shared';
import { Button } from './Button';
import { useTheme } from '../theme/ThemeProvider';
import { DelayedActivityIndicator } from './DelayedActivityIndicator';

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }

export function PhotoViewer({ uri, onError, onSend }: { uri: string; onError: () => void; onSend?: () => void }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const current = useRef(transform);
  const start = useRef({ scale: 1, distance: 0, x: 0, y: 0 });
  const bounds = useRef({ width: 0, height: 0 });
  function update(scale: number, x: number, y: number) {
    const nextScale = clamp(scale, 1, 4);
    const next = { scale: nextScale, x: clamp(x, -bounds.current.width * (nextScale - 1) / 2, bounds.current.width * (nextScale - 1) / 2), y: clamp(y, -bounds.current.height * (nextScale - 1) / 2, bounds.current.height * (nextScale - 1) / 2) };
    current.current = next;
    setTransform(next);
  }
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 2,
    onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 2 || current.current.scale > 1,
    onPanResponderGrant: (event) => {
      const [a, b] = event.nativeEvent.touches;
      start.current = { ...current.current, distance: a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0 };
    },
    onPanResponderMove: (event, gesture) => {
      const [a, b] = event.nativeEvent.touches;
      if (a && b) {
        const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
        if (start.current.distance <= 0) start.current = { ...current.current, distance };
        if (start.current.distance > 0) update(start.current.scale * distance / start.current.distance, start.current.x, start.current.y);
      } else update(start.current.scale, start.current.x + gesture.dx, start.current.y + gesture.dy);
    },
  }), []);
  return <View style={styles.container}>
    <View style={styles.viewport} onLayout={(event) => { bounds.current = event.nativeEvent.layout; }} {...responder.panHandlers}>
      <Image source={{ uri }} resizeMode="contain" accessibilityLabel={strings.media.photo} onLoadStart={() => setLoading(true)} onLoadEnd={() => setLoading(false)} onError={onError} style={[styles.image, { transform: [{ translateX: transform.x }, { translateY: transform.y }, { scale: transform.scale }] }]} />
      {loading ? <DelayedActivityIndicator active={loading} style={styles.spinner} color={theme.colors.brand.primary} accessibilityLabel="Loading photo" /> : null}
    </View>
    {onSend ? <View style={styles.controls}>
      <Button label="Send" variant="pill" onPress={onSend} />
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, width: '100%' }, viewport: { flex: 1, overflow: 'hidden' }, image: { width: '100%', height: '100%' }, spinner: { position: 'absolute', top: '50%', left: '50%' }, controls: { flexDirection: 'row', justifyContent: 'center' } });
