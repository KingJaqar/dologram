/**
 * CMP-05: Avatar component.
 * Sizes: 24, 28, 40, 48, 56, 64, 96.
 * Initials: first code point of each of the first two words.
 * Fill: sum of UTF-16 code units of id modulo 7, into avatarFills.
 * Special: Saved Messages uses bookmark icon; deleted/former use person icon.
 * 12.3, D-95
 */
import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';

export type AvatarSize = 24 | 28 | 40 | 48 | 56 | 64 | 96;

export interface AvatarProps {
  id: string;
  displayName: string;
  size?: AvatarSize;
  /** Public profile image URL. Falls back to initials when absent or unavailable. */
  imageUrl?: string | null;
  /** When true, renders the Saved Messages bookmark icon. */
  isSavedMessages?: boolean;
  /** When 'deleted' or 'former', renders the person icon on muted bg. */
  personState?: 'normal' | 'deleted' | 'former';
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
  imageUrl,
  isSavedMessages = false,
  personState = 'normal',
}: AvatarProps) {
  const theme = useTheme();
  const c = theme.colors;
  const fills = theme.avatarFills;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

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
  } else if (imageUrl && failedImageUrl !== imageUrl) {
    bgColor = c.badge.muted.bg;
    content = (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size }}
        resizeMode="cover"
        onError={() => setFailedImageUrl(imageUrl)}
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

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {content}
    </View>
  );
}
