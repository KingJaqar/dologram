import * as Linking from 'expo-linking';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { strings } from '@dologram/shared';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useAuth } from '../src/auth/AuthProvider';
import { actionToast } from '../src/notifications/toastCopy';
import { useToast } from '../src/components/Toast';
import { SwitchRow } from '../src/components/SwitchRow';
import { TopBar } from '../src/components/TopBar';
import { goBackOrReplace } from '../src/navigation/goBackOrReplace';
import {
  loadNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../src/notifications/preferences';
import {
  getPushRegistration,
  isNotificationRuntimeAvailable,
  subscribePushRegistration,
  syncPushRegistration,
} from '../src/notifications/pushNotifications';

function SectionHeader({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text style={[textStyle(theme.typeTokens.labelMd), styles.sectionHeader, { color: theme.colors.text.secondary }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

function DeviceSettingsRow({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={strings.notifications.openDeviceSettings}
      style={({ pressed }) => [styles.deviceRow, { backgroundColor: pressed ? theme.colors.bg.pressed : 'transparent' }]}
    >
      <View style={styles.deviceText}>
        <Text style={[textStyle(theme.typeTokens.bodyLg), { color: theme.colors.text.primary }]}>{strings.notifications.openDeviceSettings}</Text>
        <Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.text.secondary }]}>{strings.notifications.openDeviceSettingsDescription}</Text>
      </View>
      <Text style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.brand.primary }]}>Open</Text>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const { session, status } = useAuth();
  const userId = status === 'signedIn' ? session?.user.id : undefined;
  const [loaded, setLoaded] = useState<{ userId: string; preferences: NotificationPreferences } | null>(null);
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);
  const registration = useSyncExternalStore(subscribePushRegistration, () => getPushRegistration(userId));
  const preferences = loaded && loaded.userId === userId ? loaded.preferences : null;

  useEffect(() => {
    let active = true;
    if (!userId) return () => { active = false; };
    void loadNotificationPreferences(userId)
      .then((result) => { if (active) setLoaded({ userId, preferences: result }); })
      .catch(() => {
        if (active) showToast({ message: strings.common.couldNotLoad });
      });
    return () => {
      active = false;
    };
  }, [showToast, userId]);

  async function update(patch: Partial<NotificationPreferences>) {
    if (!userId || !preferences || saveInProgress.current) return;
    saveInProgress.current = true;
    setSaving(true);
    try {
      const next = await updateNotificationPreferences(userId, patch);
      setLoaded({ userId, preferences: next });
      if (patch.enabled !== undefined) showToast(actionToast(patch.enabled ? 'enableNotifications' : 'disableNotifications', 'success'));
      void syncPushRegistration(userId, patch.enabled === true ? 'explicit' : 'never');
    } catch {
      showToast(patch.enabled !== undefined ? actionToast(patch.enabled ? 'enableNotifications' : 'disableNotifications', 'error') : { message: strings.notifications.saveFailed, variant: 'error' });
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  async function openDeviceSettings() {
    try {
      await Linking.openSettings();
    } catch {
      showToast({ message: strings.common.couldNotLoad });
    }
  }

  const controlsDisabled = saving || !preferences || !isNotificationRuntimeAvailable;
  const disabled = controlsDisabled || !preferences?.enabled;
  const supportsVibration = Platform.OS === 'android' && Number(Platform.Version) >= 26;
  const supportsSound = Platform.OS === 'ios' || supportsVibration;
  const masterDescription = Platform.OS === 'web' ? strings.notifications.webUnavailable
    : !isNotificationRuntimeAvailable ? strings.notifications.buildRequired
      : registration === 'permission' ? strings.notifications.permissionRequired
        : strings.notifications.enabledDescription;
  const syncMessage = registration === 'syncing' ? strings.notifications.syncing
    : registration === 'pending' ? strings.notifications.pending
      : registration === 'failed' ? strings.notifications.syncFailed
        : registration === 'configuration' ? strings.notifications.pushNotConfigured : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg.app }}>
      <TopBar title={strings.notifications.title} onBack={() => goBackOrReplace(router, '/(main)/(tabs)/settings')} />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.space[8] }}>
        <SectionHeader>{strings.notifications.general}</SectionHeader>
        <View style={{ paddingHorizontal: theme.space[4] }}>
          <SwitchRow
            label={strings.notifications.enabled}
            description={masterDescription}
            value={isNotificationRuntimeAvailable && preferences?.enabled === true}
            onValueChange={(value) => void update({ enabled: value })}
            disabled={controlsDisabled}
          />
          <SwitchRow
            label={strings.notifications.messagePreviews}
            description={preferences?.enabled === false ? strings.notifications.disabledDescription : strings.notifications.messagePreviewsDescription}
            value={preferences?.messagePreviews === true}
            onValueChange={(value) => void update({ messagePreviews: value })}
            disabled={disabled}
          />
          <SwitchRow
            label={strings.notifications.sounds}
            description={supportsSound ? strings.notifications.soundsDescription : strings.notifications.soundDeviceControlled}
            value={supportsSound && preferences?.sounds === true}
            onValueChange={(value) => void update({ sounds: value })}
            disabled={disabled || !supportsSound}
          />
          <SwitchRow
            label={strings.notifications.vibration}
            description={supportsVibration ? strings.notifications.vibrationDescription : strings.notifications.vibrationDeviceControlled}
            value={supportsVibration && preferences?.vibration === true}
            onValueChange={(value) => void update({ vibration: value })}
            disabled={disabled || !supportsVibration}
          />
          <SwitchRow
            label={strings.notifications.badges}
            description={Platform.OS === 'android' ? strings.notifications.badgesAndroidDescription : strings.notifications.badgesDescription}
            value={preferences?.badges === true}
            onValueChange={(value) => void update({ badges: value })}
            disabled={disabled}
          />
          {syncMessage && (
            <Text accessibilityLiveRegion="polite" style={[textStyle(theme.typeTokens.bodySm), styles.syncStatus, { color: theme.colors.text.secondary }]}>
              {syncMessage}
            </Text>
          )}
          {registration === 'failed' && userId && (
            <Pressable accessibilityRole="button" accessibilityLabel={strings.notifications.retry} onPress={() => void syncPushRegistration(userId)}>
              <Text style={[textStyle(theme.typeTokens.bodyMd), styles.retry, { color: theme.colors.brand.primary }]}>{strings.notifications.retry}</Text>
            </Pressable>
          )}
        </View>

        <SectionHeader>{strings.notifications.chats}</SectionHeader>
        <View style={[styles.infoRow, { paddingHorizontal: theme.space[4] }]}>
          <Text style={[textStyle(theme.typeTokens.bodyLg), { color: theme.colors.text.primary }]}>{strings.notifications.chatOverrides}</Text>
          <Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.text.secondary }]}>{strings.notifications.chatOverridesDescription}</Text>
        </View>

        {Platform.OS !== 'web' && <>
          <SectionHeader>{strings.notifications.device}</SectionHeader>
          <DeviceSettingsRow onPress={() => void openDeviceSettings()} />
        </>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  infoRow: { paddingVertical: 12, gap: 4 },
  deviceRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  deviceText: { flex: 1, gap: 2 },
  syncStatus: { paddingTop: 8 },
  retry: { paddingVertical: 12 },
});
