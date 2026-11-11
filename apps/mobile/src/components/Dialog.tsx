/**
 * CMP-16: Confirmation dialog.
 * Dismissive action on the left, confirming on the right.
 * 12.5, D-95
 */
import React, { useEffect } from 'react';
import {
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ToastModalHost } from './Toast';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Button } from './Button';

export interface DialogProps {
  visible: boolean;
  title: string;
  message?: string;
  children?: React.ReactNode;
  confirmLabel: string;
  dismissLabel?: string;
  onConfirm: () => void;
  onDismiss: () => void;
  /** Renders confirmLabel in danger style. */
  destructive?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
}

export function Dialog({
  visible,
  title,
  message,
  children,
  confirmLabel,
  dismissLabel = 'Cancel',
  onConfirm,
  onDismiss,
  destructive = false,
  busy = false,
  confirmDisabled = false,
}: DialogProps) {
  const theme = useTheme();
  const c = theme.colors;

  // Android back button
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible, onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop, { backgroundColor: c.scrim }]}
        onPress={onDismiss}
        accessibilityLabel="Cancel"
        accessibilityRole="button"
      />
      <View style={styles.centerer} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.bg.elevated,
              borderRadius: theme.radius.xl,
              padding: theme.space[7],
              elevation: theme.elevation[3].android,
            },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[textStyle(theme.typeTokens.titleMd), { color: c.text.primary, marginBottom: 8 }]}
          >
            {title}
          </Text>

          {message ? (
            <Text
              style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary, marginBottom: 20 }]}
            >
              {message}
            </Text>
          ) : null}

          {children}

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                label={dismissLabel}
                variant="text"
                onPress={onDismiss}
                disabled={busy}
                fullWidth
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={confirmLabel}
                variant={destructive ? 'danger' : 'primary'}
                onPress={onConfirm}
                disabled={busy || confirmDisabled}
                loading={busy}
                fullWidth
              />
            </View>
          </View>
        </View>
      </View>
      {ToastModalHost ? <ToastModalHost visible={visible} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { justifyContent: 'center', alignItems: 'center' },
  centerer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: { width: '100%' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
