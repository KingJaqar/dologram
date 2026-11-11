/**
 * CMP-02: Text field with label, helper and error.
 * 12.5, D-95
 */
import React, { forwardRef, useState } from 'react';
import {
  TextInput,
  Text,
  View,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  helper?: string;
  error?: string;
  /** Current length, shown as "<value> / <maxLength>" when set. */
  charCount?: number;
  maxLength?: number;
  /** Element rendered at the trailing edge of the field, e.g. a show-password button. */
  trailing?: React.ReactNode;
  /** Element rendered at the leading edge of the field, e.g. a username prefix. */
  leading?: React.ReactNode;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  function TextField(
    { label, helper, error, charCount, maxLength, trailing, leading, style, ...inputProps },
    ref,
  ) {
    const theme = useTheme();
    const c = theme.colors;
    const hasError = Boolean(error);

    const borderColor = hasError ? c.error.text : c.separator;
    const focusedBorderColor = hasError ? c.error.text : c.brand.primary;
    const flattenedInputStyle = StyleSheet.flatten(style);
    const inputTextColor = flattenedInputStyle?.color ?? c.text.primary;
    const [focused, setFocused] = useState(false);

    const showCounter =
      charCount !== undefined && maxLength !== undefined;

    return (
      <View style={styles.root}>
        {label ? (
          <Text
            style={[textStyle(theme.typeTokens.labelMd), { color: c.text.secondary, marginBottom: 4 }]}
            maxFontSizeMultiplier={1.5}
          >
            {label}
          </Text>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            {...inputProps}
            ref={ref}
            style={[
              {
                minHeight: 48,
                alignSelf: 'stretch',
                paddingVertical: 10,
                borderRadius: theme.radius.md,
                borderWidth: 1.5,
                borderColor: focused ? focusedBorderColor : borderColor,
                paddingHorizontal: theme.space[4],
                ...(leading ? { paddingLeft: 44 } : {}),
                ...(trailing ? { paddingRight: 48 } : {}),
                backgroundColor: c.bg.input,
                ...textStyle(theme.typeTokens.bodyLg),
                color: inputTextColor,
              },
              style,
              // Keep the resolved text color last so Android does not fall back to
              // the native theme color when a caller supplies an array style.
              { color: inputTextColor },
            ]}
            placeholderTextColor={c.text.muted}
            onFocus={(e) => {
              setFocused(true);
              inputProps.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              inputProps.onBlur?.(e);
            }}
            maxLength={maxLength}
            accessibilityLabel={inputProps.accessibilityLabel ?? label}
          />
          {leading ? <View style={styles.leading}>{leading}</View> : null}
          {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>

        <View style={styles.footer}>
          {error ? (
            <Text
              style={[textStyle(theme.typeTokens.bodySm), { color: c.error.text, flex: 1 }]}
              accessibilityRole="alert"
            >
              {error}
            </Text>
          ) : helper ? (
            <Text
              style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary, flex: 1 }]}
            >
              {helper}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {showCounter ? (
            <Text
              style={[textStyle(theme.typeTokens.bodySm), { color: c.text.muted }]}
              maxFontSizeMultiplier={1.5}
            >
              {charCount} / {maxLength}
            </Text>
          ) : null}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  root: { gap: 0 },
  inputRow: { justifyContent: 'center' },
  trailing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  leading: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', marginTop: 4, alignItems: 'center' },
});
