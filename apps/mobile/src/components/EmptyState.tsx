/**
 * CMP-19: Empty state and CMP-20: Error state.
 * 96 circle with an xl icon. ErrorState shows "Retry" when onRetry is passed.
 * 12.5, D-95
 */
import React from 'react';
import { Image, Text, View, type ImageSourcePropType } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';
import { Button } from './Button';

export interface EmptyStateProps {
  iconName?: string;
  imageSource?: ImageSourcePropType;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}

export function EmptyState({
  iconName = 'nav.chats',
  imageSource,
  title,
  message,
  actionLabel,
  onAction,
  actionDisabled = false,
}: EmptyStateProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space[4],
        padding: theme.space[6],
      }}
    >
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: c.bg.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={{ width: 80, height: 80 }}
            resizeMode="contain"
            accessible={false}
          />
        ) : (
          <Icon name={iconName} size="xl" color={c.text.muted} />
        )}
      </View>
      <Text
        style={[textStyle(theme.typeTokens.titleMd), { color: c.text.primary, textAlign: 'center' }]}
      >
        {title}
      </Text>
      {message ? (
        <Text
          style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary, textAlign: 'center' }]}
        >
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} disabled={actionDisabled} />
      ) : null}
    </View>
  );
}

// ─── ErrorState ───────────────────────────────────────────────────────────────

export interface ErrorStateProps {
  iconName?: string;
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  iconName = 'admin.fail',
  title = "Couldn't load",
  message = 'Check your connection and try again.',
  onRetry,
}: ErrorStateProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space[4],
        padding: theme.space[6],
      }}
    >
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: c.error.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={iconName} size="xl" color={c.error.text} />
      </View>
      <Text
        style={[textStyle(theme.typeTokens.titleMd), { color: c.text.primary, textAlign: 'center' }]}
      >
        {title}
      </Text>
      {message ? (
        <Text
          style={[textStyle(theme.typeTokens.bodyMd), { color: c.text.secondary, textAlign: 'center' }]}
        >
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <Button label="Retry" variant="secondary" onPress={onRetry} />
      ) : null}
    </View>
  );
}
