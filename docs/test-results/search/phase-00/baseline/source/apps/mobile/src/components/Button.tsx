/**
 * CMP-01: Button and IconButton components.
 * Variants: Primary, Secondary, Text, Danger, Icon.
 * 12.5, D-95, D-142
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import type { IconSize } from '@dologram/shared';
import { textStyle } from '../theme/typography';
import { useDelayedFlag } from '../hooks/useDelayedFlag';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'pill';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const c = theme.colors;
  const isDisabled = disabled || loading;
  const showSpinner = useDelayedFlag(loading);

  const containerStyle: ViewStyle = {
    height: 48,
    minWidth: 88,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space[6],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
    ...(fullWidth ? { width: '100%' } : {}),
    ...(variant === 'primary' && { backgroundColor: c.brand.primary }),
    ...(variant === 'secondary' && {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: c.brand.primary,
    }),
    ...(variant === 'danger' && { backgroundColor: c.error.bg }),
    ...(variant === 'pill' && {
      backgroundColor: c.brand.primary,
      height: 44,
      minWidth: 100,
      minHeight: 44,
      borderRadius: 24,
      paddingHorizontal: 18,
    }),
    ...(variant === 'text' && { backgroundColor: 'transparent' }),
    ...(isDisabled && { opacity: 0.5 }),
  };

  const labelColor: string =
    variant === 'primary'
      ? c.text.inverse
      : variant === 'pill'
        ? c.bubble.outgoingText
      : variant === 'danger'
        ? c.error.text
        : c.brand.primary;

  const labelStyle: TextStyle = {
    ...textStyle(theme.typeTokens.labelLg),
    color: labelColor,
  };

  return (
    <Pressable
      style={({ pressed }) => [
        containerStyle,
        pressed && !isDisabled
          ? {
              backgroundColor:
                variant === 'primary' || variant === 'pill'
                  ? c.brand.pressed
                  : c.bg.pressed,
            }
          : undefined,
      ]}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      {...rest}
    >
      {showSpinner ? (
        <ActivityIndicator
          size="small"
          color={labelColor}
          accessibilityLabel="Loading"
        />
      ) : (
        <Text style={labelStyle} maxFontSizeMultiplier={1.5} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────

export interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  iconName: string;
  iconSize?: IconSize;
  color?: string;
  /** Required for screen reader (D-95). */
  accessibilityLabel: string;
}

export function IconButton({
  iconName,
  iconSize = 'md',
  color,
  accessibilityLabel,
  disabled,
  ...rest
}: IconButtonProps) {
  const theme = useTheme();
  const iconColor = color ?? theme.colors.text.primary;

  return (
    <Pressable
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 24, // visual circle is 40, tap target is 48
        backgroundColor: pressed ? theme.colors.bg.pressed : 'transparent',
        opacity: disabled ? 0.5 : 1,
      })}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      {...rest}
    >
      <Icon
        name={iconName}
        size={iconSize}
        color={iconColor}
      />
    </Pressable>
  );
}
