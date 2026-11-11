/** Editable profile screen opened from the profile row in Settings. */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { dgTrim, strings, validateDisplayName, validateUsername } from '@dologram/shared';
import { useTheme } from '../src/theme/ThemeProvider';
import { textStyle } from '../src/theme/typography';
import { useNetState } from '../src/net/netState';
import { useAuth } from '../src/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { useToast } from '../src/components/Toast';
import { Avatar } from '../src/components/Avatar';
import { Button } from '../src/components/Button';
import { BottomSheet } from '../src/components/BottomSheet';
import { Icon } from '../src/components/Icon';
import { TextField } from '../src/components/TextField';
import { TopBar } from '../src/components/TopBar';
import { goBackOrReplace } from '../src/navigation/goBackOrReplace';

function isUsernameTaken(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('username') || message.includes('duplicate key');
}

const PROFILE_AVATAR_BUCKET = 'avatars';

type AvatarSource = 'camera' | 'library';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const net = useNetState();
  const { showToast } = useToast();
  const { session, profile, refreshProfile, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(() => profile?.display_name ?? '');
  const [username, setUsername] = useState(() => profile?.username ?? '');
  const [displayNameError, setDisplayNameError] = useState<string | undefined>();
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [avatarSheetVisible, setAvatarSheetVisible] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loading, setLoading] = useState(!profile);

  useEffect(() => {
    if (profile) return;

    let active = true;
    void refreshProfile()
      .then((loadedProfile) => {
        if (!active || !loadedProfile) return;
        setDisplayName(loadedProfile.display_name);
        setUsername(loadedProfile.username);
      })
      .catch(() => {
        if (active) setFormError(strings.common.couldNotLoad);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile, refreshProfile]);

  async function handleSave() {
    if (saving || !net.isConnected || loading) return;

    const nextDisplayName = dgTrim(displayName);
    const nextUsername = username.trim().toLowerCase();
    const nextDisplayNameError = validateDisplayName(nextDisplayName)
      ? undefined
      : strings.signUp.displayNameRequired;
    const nextUsernameError = validateUsername(nextUsername)
      ? undefined
      : strings.signUp.usernameInvalid;

    setDisplayNameError(nextDisplayNameError);
    setUsernameError(nextUsernameError);
    setFormError(undefined);
    if (nextDisplayNameError || nextUsernameError) return;

    setSaving(true);
    try {
      await updateProfile({ display_name: nextDisplayName, username: nextUsername });
      setDisplayName(nextDisplayName);
      setUsername(nextUsername);
      showToast({ message: strings.profile.saved });
      goBackOrReplace(router, '/(main)/(tabs)/settings');
    } catch (error) {
      if (isUsernameTaken(error)) {
        setUsernameError(strings.signUp.usernameTaken);
      } else {
        setFormError(strings.profile.updateFailed);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarPick(source: AvatarSource) {
    const userId = session?.user.id;
    if (!userId || avatarUploading || saving || loading || !net.isConnected) return;

    setAvatarSheetVisible(false);
    setAvatarUploading(true);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showToast({ message: strings.profile.permissionDenied });
          return;
        }
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const converted = await ImageManipulator.manipulateAsync(
        asset.uri,
        [],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 },
      );
      const file = new File(converted.uri);
      const body = await file.arrayBuffer();
      const storagePath = `${userId}/avatar`;
      try {
        const { error: uploadError } = await supabase.storage
          .from(PROFILE_AVATAR_BUCKET)
          .upload(storagePath, body, {
            cacheControl: '3600',
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        await updateProfile({ avatar_url: storagePath });
        showToast({ message: strings.profile.saved });
      } finally {
        if (converted.uri !== asset.uri && file.exists) file.delete();
      }
    } catch {
      showToast({ message: strings.profile.pictureFailed });
    } finally {
      setAvatarUploading(false);
    }
  }

  const displayNamePreview = displayName || strings.settings.profileFallback;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg.app }}>
      <TopBar title={strings.profile.title} onBack={() => goBackOrReplace(router, '/(main)/(tabs)/settings')} />
      <BottomSheet visible={avatarSheetVisible} onClose={() => setAvatarSheetVisible(false)}>
        <View style={[styles.sheetContent, { padding: theme.space[4] }]}>
          <Text style={[textStyle(theme.typeTokens.titleSm), { color: theme.colors.text.primary }]}>
            {strings.profile.changePicture}
          </Text>
          <Pressable
            onPress={() => void handleAvatarPick('camera')}
            accessibilityRole="button"
            accessibilityLabel={strings.profile.takePhoto}
            style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: theme.colors.bg.pressed }]}
          >
            <Icon name="action.camera" size="md" color={theme.colors.text.primary} accessibilityLabel="" />
            <Text style={[textStyle(theme.typeTokens.bodyLg), { color: theme.colors.text.primary }]}>
              {strings.profile.takePhoto}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void handleAvatarPick('library')}
            accessibilityRole="button"
            accessibilityLabel={strings.profile.choosePhoto}
            style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: theme.colors.bg.pressed }]}
          >
            <Icon name="media.photo" size="md" color={theme.colors.text.primary} accessibilityLabel="" />
            <Text style={[textStyle(theme.typeTokens.bodyLg), { color: theme.colors.text.primary }]}>
              {strings.profile.choosePhoto}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: theme.space[6] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => setAvatarSheetVisible(true)}
          disabled={avatarUploading || loading || saving || !net.isConnected}
          accessibilityRole="button"
          accessibilityLabel={strings.profile.changePicture}
          style={styles.avatarButton}
        >
          <Avatar
            id={profile?.user_id ?? session?.user.id ?? 'unknown'}
            displayName={displayNamePreview}
            imageUrl={profile?.avatar_url}
            size={96}
          />
          <View style={[styles.cameraBadge, { backgroundColor: theme.colors.brand.primary }]}>
            {avatarUploading ? (
              <ActivityIndicator size="small" color={theme.colors.text.inverse} />
            ) : (
              <Icon name="action.camera" size="sm" color={theme.colors.text.inverse} accessibilityLabel="" />
            )}
          </View>
        </Pressable>

        <View style={styles.form}>
          <TextField
            label={strings.signUp.displayName}
            value={displayName}
            onChangeText={(value) => {
              setDisplayName(value);
              setDisplayNameError(undefined);
              setFormError(undefined);
            }}
            error={displayNameError}
            helper={strings.profile.displayNameHelper}
            autoComplete="name"
            autoCapitalize="words"
            autoCorrect={false}
            editable={!loading && !saving}
            maxLength={64}
            charCount={displayName.length}
          />

          <TextField
            label={strings.signUp.username}
            value={username}
            onChangeText={(value) => {
              setUsername(value.toLowerCase());
              setUsernameError(undefined);
              setFormError(undefined);
            }}
            error={usernameError}
            helper={strings.signUp.usernameHelper}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading && !saving}
            maxLength={32}
            leading={
              <Text style={[textStyle(theme.typeTokens.bodyLg), { color: theme.colors.text.secondary }]}>@</Text>
            }
          />

          <TextField
            label={strings.profile.email}
            value={session?.user.email ?? ''}
            editable={false}
            autoComplete="email"
            autoCapitalize="none"
          />
        </View>

        {formError ? (
          <Text style={[textStyle(theme.typeTokens.bodySm), styles.formError, { color: theme.colors.error.text }]} accessibilityRole="alert">
            {formError}
          </Text>
        ) : null}

        {!net.isConnected ? (
          <Text style={[textStyle(theme.typeTokens.bodySm), styles.formError, { color: theme.colors.text.secondary }]}>
            {strings.common.noConnection}
          </Text>
        ) : null}

        <View style={styles.saveButton}>
          <Button
            label={strings.profile.save}
            fullWidth
            loading={saving || loading}
            disabled={!net.isConnected || loading}
            onPress={() => void handleSave()}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingBottom: 40 },
  avatarButton: { position: 'relative' },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { width: '100%', marginTop: 32, gap: 16 },
  formError: { width: '100%', marginTop: 16, textAlign: 'center' },
  saveButton: { width: '100%', marginTop: 32 },
  sheetContent: { gap: 4 },
  sheetRow: {
    minHeight: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
  },
});
