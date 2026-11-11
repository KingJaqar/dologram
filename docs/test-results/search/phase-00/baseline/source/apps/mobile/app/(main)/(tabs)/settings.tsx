/** AND-14 Settings screen (D-83, D-109). */
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { strings } from '@dologram/shared';
import { useTheme } from '../../../src/theme/ThemeProvider';
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

interface SettingsRowProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  helper?: string;
  value?: string;
  danger?: boolean;
}

const ROW_HEIGHT = 56;

function SettingsRow({ label, onPress, disabled = false, helper, value, danger = false }: SettingsRowProps) {
  const theme = useTheme();
  const labelColor = danger ? theme.colors.error.text : theme.colors.text.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        minHeight: ROW_HEIGHT,
        justifyContent: 'center',
        paddingHorizontal: theme.space[4],
        backgroundColor: pressed && !disabled ? theme.colors.bg.pressed : 'transparent',
        opacity: disabled ? 0.5 : 1,
      })}
    >
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
      setSignOutDialogVisible(false);
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
        await clearLocalData();
        const { error } = await supabase.auth.signOut();
        if (error) {
          const localResult = await supabase.auth.signOut({ scope: 'local' });
          if (localResult.error) throw localResult.error;
        }
      });
    } catch {
      showToast({ message: strings.settings.signOutFailed });
    } finally {
      setSigningOut(false);
      setSignOutDialogVisible(false);
    }
  }

  function requestSignOut() {
    if (unsentCount === null) {
      void refreshUnsentCount();
      return;
    }
    if (unsentCount > 0) {
      setSignOutDialogVisible(true);
    } else {
      void handleSignOut();
    }
  }

  const displayName = profile?.display_name || strings.settings.profileFallback;
  const username = profile?.username ? `@${profile.username}` : '';
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const build = Constants.platform?.android?.versionCode ?? Constants.expoConfig?.android?.versionCode ?? 'dev';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg.app }}>
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
            value={theme.scheme === 'dark'}
            onValueChange={(value) => theme.setSetting(value ? 'dark' : 'light')}
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
        </View>

        <SectionHeader>{strings.settings.chats}</SectionHeader>
        <SettingsRow label={strings.settings.folders} onPress={() => router.push('/folders')} />

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
      </ScrollView>

      <Dialog
        visible={signOutDialogVisible}
        title={strings.settings.signOutTitle}
        message={strings.settings.signOutBody(unsentCount ?? 0)}
        confirmLabel={strings.settings.signOut}
        onConfirm={() => void handleSignOut()}
        onDismiss={() => setSignOutDialogVisible(false)}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: { flexDirection: 'row', alignItems: 'center', minHeight: 88, gap: 16 },
  profileText: { flex: 1, gap: 4 },
  sectionHeader: { paddingHorizontal: 16 },
  rowText: { flex: 1, gap: 2 },
  about: { paddingHorizontal: 16 },
});
