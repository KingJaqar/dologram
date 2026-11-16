/** AND-14 Settings screen (D-83, D-109). */
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { strings } from '@dologram/shared';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { ThemeSurface, ThemeText as Text, THEME_TRANSITION_DURATION } from '../../../src/theme/ThemeSurface';
import { textStyle } from '../../../src/theme/typography';
import { useNetState } from '../../../src/net/netState';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/auth/AuthProvider';
import { Avatar } from '../../../src/components/Avatar';
import { Icon } from '../../../src/components/Icon';
import { Dialog } from '../../../src/components/Dialog';
import { useToast } from '../../../src/components/Toast';
import { SwitchRow } from '../../../src/components/SwitchRow';
import { setForceLowSignalMode, useForceLowSignalMode } from '../../../src/net/lowSignalPreferences';
import { subscribeQueueChange } from '../../../src/queue/events';
import { getUnsentItems } from '../../../src/queue/localQueue';
import { clearLocalData } from '../../../src/storage/localData';
import { withPushRegistrationPaused } from '../../../src/notifications/pushNotifications';
import { saveCurrentAccount } from '../../../src/auth/savedAccounts';
import { stopCurrentCallForSessionChange } from '../../../src/calls/lifecycle';
import { withMemoSessionChange } from '../../../src/memos/lifecycle';
import { useLocalUpdate } from '../../../src/updates/useLocalUpdate';
import { usePressHighlight } from '../../../src/hooks/usePressHighlight';
import { ReadPrivacyControl } from '../../../src/components/ReadPrivacyControl';

interface SettingsRowProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  helper?: string;
  value?: string;
  danger?: boolean;
  busy?: boolean;
}

const ROW_HEIGHT = 56;

function SettingsRow({ label, onPress, disabled = false, helper, value, danger = false, busy = false }: SettingsRowProps) {
  const theme = useTheme();
  const labelColor = danger ? theme.colors.error.text : theme.colors.text.primary;
  const { style: highlightStyle, onPressIn, onPressOut } = usePressHighlight(theme.reduceMotion);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      style={{
        minHeight: ROW_HEIGHT,
        justifyContent: 'center',
        paddingHorizontal: theme.space[4],
        overflow: 'hidden',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg.pressed }, highlightStyle]}
      />
      <View style={styles.rowText}>
        <Text style={[textStyle(theme.typeTokens.bodyLg), { color: labelColor }]}>{label}</Text>
        {helper ? (
          <Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.text.secondary }]}>
            {helper}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.text.secondary }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SectionHeader({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text
      style={[
        textStyle(theme.typeTokens.labelMd),
        styles.sectionHeader,
        { color: theme.colors.text.secondary, paddingTop: theme.space[5], paddingBottom: theme.space[2] },
      ]}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const net = useNetState();
  const { showToast } = useToast();
  const { profile, session } = useAuth();
  const update = useLocalUpdate(session?.user.id ?? null);
  const { height } = useWindowDimensions();
  const forceLowSignal = useForceLowSignalMode();
  const [signOutDialogVisible, setSignOutDialogVisible] = useState(false);
  const [unsentCount, setUnsentCount] = useState<number | null>(null);
  const [unsentCountError, setUnsentCountError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const offline = !net.isConnected;
  const refreshUnsentCount = useCallback(async () => {
    setUnsentCount(null);
    setUnsentCountError(false);
    try {
      setUnsentCount((await getUnsentItems()).length);
    } catch {
      setUnsentCountError(true);
      showToast({ message: strings.common.couldNotLoad });
    }
  }, [showToast]);

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void refreshUnsentCount();
    }, 0);
    const unsubscribe = subscribeQueueChange(() => void refreshUnsentCount());
    return () => {
      clearTimeout(initialLoad);
      unsubscribe();
    };
  }, [refreshUnsentCount]);

  async function handleSignOut() {
    if (signingOut) return;
    if (unsentCount === null) {
      void refreshUnsentCount();
      return;
    }
    setSigningOut(true);
    try {
      // Keep the active account available to the signed-out Manage Accounts screen.
      if (session?.refresh_token) {
        await saveCurrentAccount({
          userId: session.user.id,
          email: session.user.email ?? null,
          username: profile?.username ?? null,
          displayName: profile?.display_name || strings.settings.profileFallback,
          avatarUrl: profile?.avatar_url ?? null,
          refreshToken: session.refresh_token,
          lastUsedAt: new Date().toISOString(),
        });
      }
      await withPushRegistrationPaused(session?.user.id, async () => {
        await stopCurrentCallForSessionChange(session?.user.id);
        await withMemoSessionChange(async () => {
          await clearLocalData();
          const { error } = await supabase.auth.signOut();
          if (error) {
            const localResult = await supabase.auth.signOut({ scope: 'local' });
            if (localResult.error) throw localResult.error;
          }
        });
      });
    } catch {
      showToast({ message: strings.settings.signOutFailed });
    } finally {
      setSigningOut(false);
      setSignOutDialogVisible(false);
    }
  }

  function requestSignOut() {
    if (signingOut) return;
    setSignOutDialogVisible(true);
    if (unsentCount === null) void refreshUnsentCount();
  }

  const displayName = profile?.display_name || strings.settings.profileFallback;
  const username = profile?.username ? `@${profile.username}` : '';
  const appVersion = update.supported && update.installed ? update.installed.versionName : Constants.expoConfig?.version ?? 'unknown';
  const build = update.supported && update.installed ? update.installed.versionCode
    : Constants.platform?.android?.versionCode ?? Constants.expoConfig?.android?.versionCode ?? 'dev';
  const updateProgress = update.phase === 'picking' ? strings.localUpdate.picking
    : update.phase === 'preparing' ? strings.localUpdate.preparing
    : update.phase === 'validating' ? strings.localUpdate.validating
    : update.phase === 'handingOff' ? strings.localUpdate.handingOff
    : update.phase === 'awaitingReturn' ? strings.localUpdate.awaitingReturn
    : update.phase === 'permissionSettings' ? strings.localUpdate.permissionBody
    : update.busy ? strings.localUpdate.pending : strings.localUpdate.helper;
  const updateBody = update.needsPermission ? (update.message ?? strings.localUpdate.permissionBody)
    : update.installed && update.candidate ? strings.localUpdate.confirm(update.filename,
      `${update.installed.versionName} (${update.installed.versionCode})`,
      `${update.candidate.versionName} (${update.candidate.versionCode})`) : '';

  return (
    <ThemeSurface style={{ flex: 1, backgroundColor: theme.colors.bg.app }}>
      <ScrollView contentContainerStyle={{ paddingBottom: theme.space[8] }}>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel={`${displayName}${username ? `, ${username}` : ''}`}
          style={({ pressed }) => [
            styles.profileCard,
            {
              padding: theme.space[4],
              backgroundColor: pressed ? theme.colors.bg.pressed : 'transparent',
            },
          ]}
        >
          <Avatar
            id={profile?.user_id ?? session?.user.id ?? 'unknown'}
            displayName={displayName}
            imageUrl={profile?.avatar_url}
            size={64}
          />
          <View style={styles.profileText}>
            <Text style={[textStyle(theme.typeTokens.titleSm), { color: theme.colors.text.primary }]}>
              {displayName}
            </Text>
            {username ? (
              <Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.text.secondary }]}>
                {username}
              </Text>
            ) : null}
          </View>
          <Icon name="nav.forward" size="md" color={theme.colors.text.secondary} />
        </Pressable>

        <SectionHeader>{strings.settings.appearance}</SectionHeader>
        <View style={{ paddingHorizontal: theme.space[4] }}>
          <SwitchRow
            label={strings.settings.theme}
            description={theme.scheme === 'dark' ? strings.settings.themeDark : strings.settings.themeLight}
            value={(theme.setting === 'system' ? theme.scheme : theme.setting) === 'dark'}
            onValueChange={(value) => theme.setSetting(value ? 'dark' : 'light')}
            animationDuration={THEME_TRANSITION_DURATION}
          />
        </View>

        <SectionHeader>{strings.settings.messages}</SectionHeader>
        <View style={{ paddingHorizontal: theme.space[4] }}>
          <SwitchRow
            label={strings.settings.forceLowSignal}
            description={strings.settings.forceLowSignalDescription}
            value={forceLowSignal}
            onValueChange={(value) => {
              void setForceLowSignalMode(value).catch(() => showToast({ message: strings.common.couldNotLoad }));
            }}
          />
          {session?.user.id ? <ReadPrivacyControl key={session.user.id} accountId={session.user.id} online={!offline} /> : null}
        </View>

        <SectionHeader>{strings.settings.chats}</SectionHeader>
        <SettingsRow label={strings.settings.folders} onPress={() => router.push('/folders')} />
        <SettingsRow label={strings.settings.blocked} onPress={() => router.push('/blocked')} />

        <SectionHeader>{strings.settings.account}</SectionHeader>

        <SettingsRow
          label={strings.settings.manageAccounts}
          helper={strings.settings.manageAccountsDescription}
          onPress={() => router.push('/manage-accounts')}
        />

        <SettingsRow
          label={strings.settings.changePassword}
          onPress={() => router.push('/change-password')}
          disabled={offline}
          helper={offline ? strings.common.noConnection : undefined}
        />

        <SettingsRow
          label={strings.settings.signOut}
          danger
          disabled={signingOut}
          helper={
            unsentCount === null
              ? (unsentCountError ? strings.common.couldNotLoad : strings.settings.checkingUnsent)
              : undefined
          }
          onPress={requestSignOut}
        />

        <SectionHeader>{strings.settings.notifications}</SectionHeader>
        <SettingsRow
          label={strings.settings.notifications}
          helper={strings.settings.notificationsDescription}
          onPress={() => router.push('/notifications')}
        />

        <SectionHeader>{strings.settings.about}</SectionHeader>
        <Text style={[textStyle(theme.typeTokens.bodySm), styles.about, { color: theme.colors.text.secondary }]}>
          DoloGram {appVersion} ({build})
        </Text>
        {update.supported ? <>
          <SettingsRow
            label={strings.localUpdate.title}
            helper={update.callBlocked ? strings.localUpdate.callBlocked : updateProgress}
            disabled={update.phase !== 'idle' || update.busy || update.callBlocked || signingOut}
            busy={update.busy}
            onPress={() => update.select()}
          />
          {update.browseAll ? <SettingsRow
            label={strings.localUpdate.browseAll}
            disabled={update.phase !== 'idle' || update.busy || update.callBlocked || signingOut}
            onPress={() => update.select(true)}
          /> : null}
          {update.message ? <Text accessibilityLiveRegion="polite"
            style={[textStyle(theme.typeTokens.bodySm), styles.about, { color: theme.colors.text.secondary }]}>
            {update.message}
          </Text> : null}
        </> : null}
      </ScrollView>

      <Dialog
        visible={update.supported && update.phase === 'confirming'}
        title={update.needsPermission ? strings.localUpdate.permissionTitle : strings.localUpdate.title}
        confirmLabel={update.needsPermission ? strings.localUpdate.openSettings : strings.localUpdate.continue}
        dismissLabel={strings.localUpdate.cancel}
        onConfirm={update.needsPermission ? update.openSettings : update.continue}
        onDismiss={update.cancel}
        busy={update.busy}
        confirmDisabled={update.callBlocked}
      >
        <ScrollView testID="local-update-details"
          style={{ maxHeight: Math.max(48, height - 300), marginBottom: theme.space[4] }}>
          <Text style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.text.secondary }]}>
            {updateBody}
          </Text>
        </ScrollView>
      </Dialog>

      <Dialog
        visible={signOutDialogVisible}
        title={strings.settings.signOutTitle}
        message={unsentCount === null
          ? (unsentCountError ? strings.common.couldNotLoad : strings.settings.checkingUnsent)
          : unsentCount > 0 ? strings.settings.signOutBody(unsentCount) : strings.settings.signOutConfirmBody}
        confirmLabel={strings.settings.signOut}
        onConfirm={() => void handleSignOut()}
        onDismiss={() => setSignOutDialogVisible(false)}
        destructive
        busy={signingOut}
        confirmDisabled={unsentCount === null}
      />
    </ThemeSurface>
  );
}

const styles = StyleSheet.create({
  profileCard: { flexDirection: 'row', alignItems: 'center', minHeight: 88, gap: 16 },
  profileText: { flex: 1, gap: 4 },
  sectionHeader: { paddingHorizontal: 16 },
  rowText: { flex: 1, justifyContent: 'center', gap: 2 },
  about: { paddingHorizontal: 16 },
});
