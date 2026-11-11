import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { strings } from '@dologram/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { useAuth } from '../auth/AuthProvider';
import {
  loadSavedAccounts,
  MAX_SAVED_ACCOUNTS,
  saveSessionAccount,
  toSavedAccount,
  type SavedAccount,
} from '../auth/savedAccounts';
import { useAccountSwitch } from '../auth/useAccountSwitch';
import { withPushRegistrationPaused } from '../notifications/pushNotifications';
import { stopCurrentCallForSessionChange } from '../calls/lifecycle';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { AccountSwitchDialog } from './AccountSwitchDialog';

interface AccountSwitcherPopoverProps {
  visible: boolean;
  onClose: () => void;
}

export function AccountSwitcherPopover({ visible, onClose }: AccountSwitcherPopoverProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { session, profile } = useAuth();
  const [mounted, setMounted] = useState(visible);
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(visible);
  const c = theme.colors;

  const currentAccount = useMemo(() => {
    if (!session) return null;
    return toSavedAccount(session, profile);
  }, [profile, session]);

  const otherAccounts = useMemo(
    () => accounts.filter((account) => account.userId !== session?.user.id).slice(0, MAX_SAVED_ACCOUNTS - 1),
    [accounts, session?.user.id],
  );

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

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    void loadSavedAccounts()
      .then((next) => {
        if (active) setAccounts(next);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible]);

  const handleClose = useCallback(() => {
    if (!visible) return;
    onClose();
  }, [onClose, visible]);

  const { switchingUserId, pendingAccount, requestSwitch, confirmSwitch, cancelSwitch } = useAccountSwitch(handleClose);
  const busy = signingOut || switchingUserId !== null || pendingAccount !== null;

  const signOut = useCallback(async () => {
    if (busy || !session) return;
    setSigningOut(true);
    try {
      await saveSessionAccount(session, profile);
      await withPushRegistrationPaused(session.user.id, async () => {
        await stopCurrentCallForSessionChange(session.user.id);
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw error;
      });
      handleClose();
    } catch {
      showToast({ message: strings.settings.signOutFailed });
    } finally {
      setSigningOut(false);
    }
  }, [busy, handleClose, profile, session, showToast]);

  if (!mounted) return null;

  const cardTranslateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] });
  const cardScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close account switcher" />
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
          <View style={styles.cardHeader}>
            <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.text.primary }]}>{strings.manageAccounts.title}</Text>
            {busy ? <ActivityIndicator size="small" color={c.brand.primary} /> : null}
          </View>

          <ScrollView style={styles.accountList} contentContainerStyle={styles.accountListContent} showsVerticalScrollIndicator={false}>
            {currentAccount ? (
              <Pressable
                onPress={() => void requestSwitch(currentAccount)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`${strings.manageAccounts.switchTo} ${currentAccount.displayName}`}
                style={({ pressed }) => [styles.accountRow, { backgroundColor: pressed ? c.bg.pressed : 'transparent' }]}
              >
                <Avatar id={currentAccount.userId} displayName={currentAccount.displayName} imageUrl={currentAccount.avatarUrl} size={40} />
                <View style={styles.accountText}>
                  <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]} numberOfLines={1}>
                    {currentAccount.displayName}
                    <Text style={[textStyle(theme.typeTokens.labelLg), { color: c.brand.primary }]}> · {strings.manageAccounts.signedIn}</Text>
                  </Text>
                  <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]} numberOfLines={1}>
                    {currentAccount.username ? `@${currentAccount.username}` : currentAccount.email ?? ''}
                  </Text>
                </View>
                <Icon name="status.sent" size="sm" color={c.text.primary} accessibilityLabel={strings.manageAccounts.activeAccount} />
              </Pressable>
            ) : null}
            {loading ? (
              <View style={styles.emptyState}><ActivityIndicator size="small" color={c.text.secondary} /></View>
            ) : otherAccounts.length > 0 ? otherAccounts.map((account) => {
              const accountLabel = account.username ? `@${account.username}` : account.email ?? strings.manageAccounts.savedAccount;
              return (
                <Pressable
                  key={account.userId}
                  onPress={() => void requestSwitch(account)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${strings.manageAccounts.switchTo} ${account.displayName}`}
                  style={({ pressed }) => [styles.accountRow, { backgroundColor: pressed ? c.bg.pressed : 'transparent', opacity: busy ? 0.6 : 1 }]}
                >
                  <Avatar id={account.userId} displayName={account.displayName} imageUrl={account.avatarUrl} size={40} />
                  <View style={styles.accountText}>
                    <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]} numberOfLines={1}>{account.displayName}</Text>
                    <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]} numberOfLines={1}>{accountLabel}</Text>
                  </View>
                  <Icon name="nav.forward" size="sm" color={c.text.secondary} accessibilityLabel="Switch account" />
                </Pressable>
              );
            }) : (
              <Text style={[textStyle(theme.typeTokens.bodySm), styles.emptyText, { color: c.text.secondary }]}>{strings.manageAccounts.otherAccounts}: —</Text>
            )}
          </ScrollView>

          <View style={[styles.actionBar, { borderTopColor: c.separator }]}>
            <Pressable
              onPress={() => {
                handleClose();
                router.push('/manage-accounts');
              }}
              disabled={busy || accounts.length >= MAX_SAVED_ACCOUNTS}
              accessibilityRole="button"
              accessibilityLabel={strings.manageAccounts.loginAnother}
              style={({ pressed }) => [styles.action, { backgroundColor: pressed ? c.bg.pressed : 'transparent', opacity: busy || accounts.length >= MAX_SAVED_ACCOUNTS ? 0.45 : 1 }]}
            >
              <Icon name="nav.new" size="md" color={c.text.primary} accessibilityLabel={strings.manageAccounts.loginAnother} />
              <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.text.primary }]}>{strings.manageAccounts.loginAnother}</Text>
            </Pressable>
            <Pressable
              onPress={() => void signOut()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={strings.settings.signOut}
              style={({ pressed }) => [styles.action, { backgroundColor: pressed ? c.bg.pressed : 'transparent', opacity: busy ? 0.45 : 1 }]}
            >
              <Icon name="action.signOut" size="md" color={c.error.text} accessibilityLabel={strings.settings.signOut} />
              <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.error.text }]}>{strings.settings.signOut}</Text>
            </Pressable>
          </View>
        </Animated.View>
        {pendingAccount ? (
          <AccountSwitchDialog account={pendingAccount} onConfirm={confirmSwitch} onDismiss={cancelSwitch} />
        ) : null}
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
  cardHeader: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accountList: { maxHeight: 248 },
  accountListContent: { paddingBottom: 4 },
  accountRow: { minHeight: 64, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountText: { flex: 1, gap: 2 },
  emptyState: { minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  emptyText: { paddingHorizontal: 16, paddingVertical: 16 },
  actionBar: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', padding: 8, gap: 6 },
  action: { flex: 1, minHeight: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
});
