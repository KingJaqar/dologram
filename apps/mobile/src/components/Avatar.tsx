/**
 * CMP-05: Avatar component.
 * Sizes: 24, 28, 40, 48, 56, 64, 96.
 * Initials: first code point of each of the first two words.
 * Fill: sum of UTF-16 code units of id modulo 7, into avatarFills.
 * Special: Saved Messages uses bookmark icon; deleted/former use person icon.
 * 12.3, D-95
 */
import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { ThemeSurface, ThemeText as Text } from '../theme/ThemeSurface';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';
import { supabase } from '../lib/supabase';

export type AvatarSize = 24 | 28 | 40 | 48 | 56 | 64 | 96;

export interface AvatarProps {
  id: string;
  displayName: string;
  size?: AvatarSize;
  /** Render a full-width rectangular profile banner instead of a circular avatar. */
  variant?: 'circle' | 'banner';
  /** Height used by the full-width banner variant. */
  bannerHeight?: number;
  /** Profile storage path or signed URL. Falls back to initials when absent or unavailable. */
  imageUrl?: string | null;
  imageBucket?: 'avatars' | 'chat-avatars';
  /** When true, renders the Saved Messages bookmark icon. */
  isSavedMessages?: boolean;
  /** When 'deleted' or 'former', renders the person icon on muted bg. */
  personState?: 'normal' | 'deleted' | 'former';
}

const PROFILE_AVATAR_BUCKET = 'avatars';
const AVATAR_SIGNED_URL_LIFETIME = 60 * 60;

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Computes initials from a display name (first code point of first two words). */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ? Array.from(words[0])[0] ?? '' : '';
  const second = words[1] ? Array.from(words[1])[0] ?? '' : '';
  return (first + second).toUpperCase();
}

/** Fill index: sum of UTF-16 code units of id modulo 7. */
function getFillIndex(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) {
    sum += id.charCodeAt(i);
  }
  return sum % 7;
}

/** Font size relative to avatar size. */
function initialsSize(size: AvatarSize): number {
  if (size <= 28) return 10;
  if (size <= 40) return 14;
  if (size <= 48) return 16;
  if (size <= 64) return 20;
  return 28;
}

export function Avatar({
  id,
  displayName,
  size = 40,
  variant = 'circle',
  bannerHeight = 236,
  imageUrl,
  imageBucket = PROFILE_AVATAR_BUCKET,
  isSavedMessages = false,
  personState = 'normal',
}: AvatarProps) {
  const theme = useTheme();
  const c = theme.colors;
  const fills = theme.avatarFills;
  const isBanner = variant === 'banner';
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{ source: string; bucket: string; url: string } | null>(null);
  // Never display a previous person's image while a new storage path is being signed.
  const resolvedImageUrl = imageUrl && isRemoteUrl(imageUrl)
    ? imageUrl
    : resolved && resolved.source === imageUrl && resolved.bucket === imageBucket ? resolved.url : null;

  useEffect(() => {
    let active = true;
    if (!imageUrl || isRemoteUrl(imageUrl)) return;

    // Profile rows contain a storage path, not a browser-readable URL. Resolve it at render time so
    // the private bucket can authorize the image for the current session.
    void supabase.storage
      .from(imageBucket)
      .createSignedUrl(imageUrl, AVATAR_SIGNED_URL_LIFETIME)
      .then(({ data, error }) => {
        if (!active) return;
        setFailedImageUrl(null);
        setResolved(error || !data?.signedUrl ? null : { source: imageUrl, bucket: imageBucket, url: data.signedUrl });
      })
      .catch(() => {
        if (active) setResolved(null);
      });

    return () => {
      active = false;
    };
  }, [imageBucket, imageUrl]);

  let bgColor: string;
  let content: React.ReactNode;

  if (isSavedMessages) {
    bgColor = c.brand.primary;
    content = (
      <Icon
        name="chat.saved"
        size="sm"
        color={c.text.inverse}
        accessibilityLabel="Saved Messages"
      />
    );
  } else if (personState === 'deleted' || personState === 'former') {
    bgColor = c.badge.muted.bg;
    content = (
      <Icon
        name="person.deleted"
        size="sm"
        color={c.badge.muted.text}
        accessibilityLabel={personState === 'deleted' ? 'Deleted account' : 'Former member'}
      />
    );
  } else if (resolvedImageUrl && failedImageUrl !== resolvedImageUrl) {
    bgColor = c.badge.muted.bg;
    content = (
      <Image
        source={{ uri: resolvedImageUrl }}
        style={isBanner ? { width: '100%', height: '100%' } : { width: size, height: size }}
        resizeMode="cover"
        onError={() => setFailedImageUrl(resolvedImageUrl)}
        accessibilityLabel="Profile picture"
      />
    );
  } else {
    const fillIdx = getFillIndex(id);
    bgColor = fills[fillIdx] ?? fills[0];
    const initials = getInitials(displayName) || '?';
    const fontSize = initialsSize(size);

    content = (
      <Text
        style={[
          textStyle(theme.typeTokens.labelLg),
          {
            fontSize,
            lineHeight: fontSize * 1.2,
            color: c.text.inverse,
            fontWeight: '600',
          },
        ]}
        numberOfLines={1}
        maxFontSizeMultiplier={1}
        accessible={false}
      >
        {initials}
      </Text>
    );
  }

  // Most avatar fills are theme-independent. Keep those as plain views so a
  // long chat list does not register needless transitions for every avatar.
  const Container = isSavedMessages || personState !== 'normal' ? ThemeSurface : View;

  return (
    <Container
      style={{
        width: isBanner ? '100%' : size,
        height: isBanner ? bannerHeight : size,
        borderRadius: isBanner ? 0 : size / 2,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {content}
    </Container>
  );
}
