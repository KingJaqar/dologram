import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

interface ChatActionsPopoverProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** Compact-to-expanded action card matching the main-header account switcher. */
export function ChatActionsPopover({ visible, onClose, children }: ChatActionsPopoverProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;
  const [mounted, setMounted] = useState(visible);
  const mountedRef = useRef(visible);
  const progress = useRef(new Animated.Value(0)).current;

  const animateClose = useCallback(() => {
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: 0,
      duration: theme.duration('fast'),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        mountedRef.current = false;
        setMounted(false);
      }
    });
  }, [progress, theme]);

  useEffect(() => {
    if (visible) {
      progress.stopAnimation();
      progress.setValue(0);
      const frame = requestAnimationFrame(() => {
        mountedRef.current = true;
        setMounted(true);
        Animated.timing(progress, {
          toValue: 1,
          duration: theme.duration('normal'),
          useNativeDriver: true,
        }).start();
      });
      return () => cancelAnimationFrame(frame);
    }

    if (mountedRef.current) animateClose();
    return undefined;
  }, [animateClose, progress, theme, visible]);

  if (!mounted) return null;

  const cardTranslateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] });
  const cardScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close chat actions" />
        <Animated.View
          style={[
            styles.card,
            {
              top: insets.top + 54,
              right: 8,
              backgroundColor: c.bg.elevated,
              borderColor: c.separator,
              shadowColor: c.shadow,
              elevation: theme.elevation[3].android,
              opacity: progress,
              transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
            },
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  card: {
    position: 'absolute',
    width: 320,
    maxWidth: '90%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
  },
});
