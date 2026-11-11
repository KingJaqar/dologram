import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { strings } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import type { SavedAccount } from '../auth/savedAccounts';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

export function AccountSwitchDialog({ account, onConfirm, onDismiss }: {
  account: SavedAccount;
  onConfirm: (dontAskAgain: boolean) => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const c = theme.colors;

  return (
    <Dialog
      visible
      title={strings.manageAccounts.switchConfirmTitle}
      message={strings.manageAccounts.switchConfirmBody(account.displayName)}
      confirmLabel={strings.manageAccounts.switchConfirm}
      onConfirm={() => onConfirm(dontAskAgain)}
      onDismiss={onDismiss}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={strings.manageAccounts.dontAskAgain}
        accessibilityState={{ checked: dontAskAgain }}
        onPress={() => setDontAskAgain((checked) => !checked)}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.bg.pressed : 'transparent' }]}
      >
        <View style={[styles.box, {
          borderColor: dontAskAgain ? c.brand.primary : c.text.secondary,
          backgroundColor: dontAskAgain ? c.brand.primary : 'transparent',
          borderRadius: theme.radius.sm,
        }]}>
          {dontAskAgain ? <Icon name="admin.success" size="sm" color={c.text.inverse} /> : null}
        </View>
        <Text style={[textStyle(theme.typeTokens.bodyMd), styles.label, { color: c.text.primary }]}>{strings.manageAccounts.dontAskAgain}</Text>
      </Pressable>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, borderRadius: 8 },
  box: { width: 24, height: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
