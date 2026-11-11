import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { strings } from '@dologram/shared';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useAuth } from '../src/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { Avatar } from '../src/components/Avatar';
import { Dialog } from '../src/components/Dialog';
import { AccountSwitchDialog } from '../src/components/AccountSwitchDialog';
import { Icon } from '../src/components/Icon';
import { IconButton } from '../src/components/Button';
import { TopBar } from '../src/components/TopBar';
import { useToast } from '../src/components/Toast';
import { goBackOrReplace } from '../src/navigation/goBackOrReplace';
import { loadSavedAccounts, MAX_SAVED_ACCOUNTS, removeSavedAccounts, saveSessionAccount, toSavedAccount, type SavedAccount } from '../src/auth/savedAccounts';
import { ADD_ACCOUNT_PARAMS } from '../src/auth/accountSession';
import { useAccountSwitch } from '../src/auth/useAccountSwitch';
import { withPushRegistrationPaused } from '../src/notifications/pushNotifications';
import { stopCurrentCallForSessionChange } from '../src/calls/lifecycle';

interface AccountRowProps {
  account: SavedAccount;
  active: boolean;
  selecting: boolean;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onRemove: () => void;
}

function AccountRow({ account, active, selecting, selected, disabled = false, onPress, onLongPress, onRemove }: AccountRowProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [swiped, setSwiped] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const username = account.username ? `@${account.username}` : account.email ?? strings.manageAccounts.savedAccount;

  const closeSwipe = useCallback(() => {
    setSwiped(false);
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
  }, [translateX]);

  const openSwipe = useCallback(() => {
    setSwiped(true);
    Animated.spring(translateX, { toValue: -80, useNativeDriver: true }).start();
  }, [translateX]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => !disabled && Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => translateX.setValue(Math.min(0, Math.max(-80, gesture.dx))),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -40 || gesture.vx < -0.5) openSwipe();
        else closeSwipe();
      },
      onPanResponderTerminate: closeSwipe,
    }),
    [closeSwipe, disabled, openSwipe, translateX],
  );

  function handlePress() {
    if (swiped) {
      closeSwipe();
      return;
    }
    onPress();
  }

  return (
    <View style={styles.rowShell}>
      <View style={[styles.removeAction, { backgroundColor: c.error.bg }]} pointerEvents={swiped ? 'auto' : 'none'}>
        <Pressable
          disabled={disabled}
          onPress={() => {
            closeSwipe();
            onRemove();
          }}
          accessibilityRole="button"
          accessibilityLabel={strings.manageAccounts.removeAccount}
          style={styles.removeActionButton}
        >
          <Icon name="action.delete" size="lg" color={c.error.text} accessibilityLabel={strings.manageAccounts.removeAccount} />
        </Pressable>
      </View>

      <Animated.View style={[styles.swipeContent, { backgroundColor: c.bg.app, transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <Pressable
          disabled={disabled}
          onPress={handlePress}
          onLongPress={onLongPress}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityLabel={`${selecting && selected ? 'Selected ' : ''}${strings.manageAccounts.switchTo} ${account.displayName}`}
          accessibilityHint="Long press to select this account. Swipe left to remove it."
          accessibilityState={{ selected, disabled }}
          style={({ pressed }) => [styles.profileRow, { backgroundColor: pressed ? c.bg.pressed : c.bg.app }]}
        >
          <Avatar id={account.userId} displayName={account.displayName} imageUrl={account.avatarUrl} size={48} />
          <View style={styles.profileText}>
            <Text style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]} numberOfLines={1}>
              {account.displayName}
              {active ? <Text style={[textStyle(theme.typeTokens.labelLg), { color: c.brand.primary }]}> · {strings.manageAccounts.signedIn}</Text> : null}
            </Text>
            <Text style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]} numberOfLines={1}>
              {username}
            </Text>
          </View>
          {selecting && selected ? (
            <Icon name="action.select" size="lg" color={c.brand.primary} accessibilityLabel="Selected" />
          ) : active ? (
            <Icon name="status.sent" size="lg" color={c.text.primary} accessibilityLabel={strings.manageAccounts.activeAccount} />
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

type PendingRemoval = { ids: string[]; all: boolean };

interface SelectionActionProps {
  iconName: string;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}

function SelectionAction({ iconName, label, accessibilityLabel, onPress, disabled = false, color }: SelectionActionProps) {
  const theme = useTheme();
  const iconColor = color ?? theme.colors.text.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: pressed && !disabled ? theme.colors.bg.pressed : 'transparent', opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Icon name={iconName} size="lg" color={iconColor} accessibilityLabel="" />
      <Text style={[textStyle(theme.typeTokens.labelMd), styles.actionLabel, { color: iconColor }]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

export default function ManageAccountsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { session, profile } = useAuth();
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const { switchingUserId, pendingAccount, requestSwitch, confirmSwitch, cancelSwitch } = useAccountSwitch();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const [pendingSignOut, setPendingSignOut] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const userId = session?.user.id ?? '';
  const busy = switchingUserId !== null || removing || signingOut;
  const currentAccount = useMemo(() => session ? toSavedAccount(session, profile) : null, [profile, session]);

  const loadAccounts = useCallback(async () => setSavedAccounts(await loadSavedAccounts()), []);
  useEffect(() => {
    let mounted = true;
    void loadSavedAccounts().then((accounts) => {
      if (mounted) setSavedAccounts(accounts);
    });
    return () => { mounted = false; };
  }, []);

  const otherAccounts = savedAccounts.filter((account) => account.userId !== userId).slice(0, currentAccount ? MAX_SAVED_ACCOUNTS - 1 : MAX_SAVED_ACCOUNTS);
  const accounts = useMemo(() => currentAccount ? [currentAccount, ...otherAccounts] : otherAccounts, [currentAccount, otherAccounts]);
  const selectedCount = selectedUserIds.length;
  const includesCurrent = pendingRemoval?.ids.includes(userId) ?? false;

  const toggleSelection = useCallback((accountId: string) => {
    setSelectedUserIds((ids) => ids.includes(accountId) ? ids.filter((id) => id !== accountId) : [...ids, accountId]);
  }, []);

  const enterSelectionMode = useCallback((accountId: string) => {
    setSelectionMode(true);
    setSelectedUserIds((ids) => ids.includes(accountId) ? ids : [...ids, accountId]);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedUserIds([]);
  }, []);

  const requestRemoval = useCallback((ids: string[], all = false) => {
    if (ids.length === 0) return;
    setPendingRemoval({ ids, all });
  }, []);

  async function confirmRemoval() {
    if (!pendingRemoval || removing) return;
    setRemoving(true);
    try {
      if (pendingRemoval.ids.includes(userId)) {
        await withPushRegistrationPaused(userId, async () => {
          await stopCurrentCallForSessionChange(userId);
          const { error } = await supabase.auth.signOut({ scope: 'local' });
          if (error) throw error;
        });
      }
      await removeSavedAccounts(pendingRemoval.ids);
      await loadAccounts();
      setPendingRemoval(null);
      exitSelectionMode();
    } catch {
      showToast({ message: strings.manageAccounts.removeFailed });
    } finally {
      setRemoving(false);
    }
  }

  async function logoutCurrentAccount(navigateTo: '/sign-in' | '/sign-up' | null = null) {
    if (signingOut) return;
    setSigningOut(true);
    try {
      if (session) await saveSessionAccount(session, profile);
      await withPushRegistrationPaused(userId, async () => {
        await stopCurrentCallForSessionChange(userId);
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw error;
      });
      if (navigateTo) router.replace(navigateTo);
    } catch {
      showToast({ message: strings.settings.signOutFailed });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.app }]}>
      <TopBar
        title={strings.manageAccounts.title}
        titleAlign="left"
        onBack={() => goBackOrReplace(router, '/(main)/(tabs)/settings')}
        right={<IconButton iconName="action.signOut" accessibilityLabel={strings.settings.signOut} onPress={() => setPendingSignOut(true)} disabled={busy} />}
      />

      <ScrollView contentContainerStyle={[styles.content, selectionMode && { paddingBottom: 112 + insets.bottom }]}>
        {currentAccount ? (
          <AccountRow
            account={currentAccount}
            active
            disabled={busy}
            selecting={selectionMode}
            selected={selectedUserIds.includes(currentAccount.userId)}
            onPress={() => selectionMode ? toggleSelection(currentAccount.userId) : void requestSwitch(currentAccount)}
            onLongPress={() => enterSelectionMode(currentAccount.userId)}
            onRemove={() => requestRemoval([currentAccount.userId])}
          />
        ) : null}

        <Text style={[textStyle(theme.typeTokens.bodySm), styles.sectionLabel, { color: theme.colors.text.secondary }]}>{strings.manageAccounts.otherAccounts}</Text>
        {otherAccounts.map((account) => (
          <AccountRow
            key={account.userId}
            account={account}
            active={false}
            disabled={busy}
            selecting={selectionMode}
            selected={selectedUserIds.includes(account.userId)}
            onPress={() => selectionMode ? toggleSelection(account.userId) : void requestSwitch(account)}
            onLongPress={() => enterSelectionMode(account.userId)}
            onRemove={() => requestRemoval([account.userId])}
          />
        ))}

        <Pressable
          onPress={() => router.push({ pathname: '/sign-in', params: ADD_ACCOUNT_PARAMS })}
          disabled={busy || accounts.length >= MAX_SAVED_ACCOUNTS}
          accessibilityRole="button"
          accessibilityLabel={strings.manageAccounts.loginAnother}
          accessibilityState={{ disabled: busy || accounts.length >= MAX_SAVED_ACCOUNTS }}
          style={({ pressed }) => [styles.loginRow, { backgroundColor: pressed ? theme.colors.bg.pressed : 'transparent', opacity: busy || accounts.length >= MAX_SAVED_ACCOUNTS ? 0.5 : 1 }]}
        >
          <Icon name="nav.new" size="lg" color={theme.colors.text.primary} accessibilityLabel="Add account" />
          <Text style={[textStyle(theme.typeTokens.bodyLg), { color: theme.colors.text.primary }]}>{strings.manageAccounts.loginAnother}</Text>
        </Pressable>
        <Text style={[textStyle(theme.typeTokens.bodySm), styles.helper, { color: theme.colors.text.secondary }]}>{switchingUserId ? strings.manageAccounts.switching : strings.manageAccounts.loginAnotherBody}</Text>
      </ScrollView>

      {selectionMode ? (
        <View style={[styles.actionBar, { backgroundColor: theme.colors.bg.elevated, borderTopColor: theme.colors.separator, paddingBottom: insets.bottom }]}>
          <SelectionAction
            iconName="action.select"
            label={strings.manageAccounts.selectAllLabel}
            accessibilityLabel={strings.manageAccounts.selectAll}
            onPress={() => setSelectedUserIds(accounts.map((account) => account.userId))}
            disabled={accounts.length === 0 || selectedCount === accounts.length}
          />
          <SelectionAction
            iconName="action.discard"
            label={strings.manageAccounts.unselectAllLabel}
            accessibilityLabel={strings.manageAccounts.unselectAll}
            onPress={() => setSelectedUserIds([])}
            disabled={selectedCount === 0}
          />
          <SelectionAction
            iconName="action.delete"
            label={strings.manageAccounts.removeSelected}
            accessibilityLabel={strings.manageAccounts.removeAccount}
            onPress={() => requestRemoval(selectedUserIds)}
            disabled={selectedCount === 0 || removing}
            color={theme.colors.error.text}
          />
          <SelectionAction
            iconName="nav.close"
            label={strings.manageAccounts.cancelSelectionLabel}
            accessibilityLabel={strings.manageAccounts.cancelSelection}
            onPress={exitSelectionMode}
          />
        </View>
      ) : null}

      {pendingAccount ? (
        <AccountSwitchDialog account={pendingAccount} onConfirm={confirmSwitch} onDismiss={cancelSwitch} />
      ) : null}

      <Dialog
        visible={pendingSignOut}
        title={strings.settings.signOutTitle}
        confirmLabel={strings.settings.signOut}
        onConfirm={() => {
          setPendingSignOut(false);
          void logoutCurrentAccount('/sign-up');
        }}
        onDismiss={() => { if (!signingOut) setPendingSignOut(false); }}
        destructive
      />

      <Dialog
        visible={pendingRemoval !== null}
        title={pendingRemoval?.all ? strings.manageAccounts.removeAccountsTitle : strings.manageAccounts.removeAccountTitle}
        message={strings.manageAccounts.removeAccountBody(pendingRemoval?.ids.length ?? 0, includesCurrent)}
        confirmLabel={strings.manageAccounts.removeConfirm}
        onConfirm={() => void confirmRemoval()}
        onDismiss={() => { if (!removing) setPendingRemoval(null); }}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: 10, paddingBottom: 32 },
  rowShell: { position: 'relative', overflow: 'hidden' },
  swipeContent: { zIndex: 1 },
  profileRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 16 },
  profileText: { flex: 1, gap: 2 },
  removeAction: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 80, alignItems: 'center', justifyContent: 'center' },
  removeActionButton: { width: 80, height: '100%', alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  loginRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 24 },
  helper: { paddingHorizontal: 18, paddingTop: 8, maxWidth: 520 },
  actionBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
  actionButton: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2, borderRadius: 8 },
  actionLabel: { textAlign: 'center' },
});
