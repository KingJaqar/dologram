/**
 * CMP-03: Search field — height 40, full radius, debounced filtering.
 * 12.5, D-95
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  TextInput,
  View,
  Pressable,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';
import { strings } from '@dologram/shared';

export interface SearchFieldProps extends Omit<TextInputProps, 'onChangeText'> {
  /** Called ~150 ms after the user stops typing. */
  onSearch: (query: string) => void;
  /** Immediate notification for controlled fields; onSearch may remain debounced. */
  onChangeText?: (query: string) => void;
  debounceMs?: number;
  inputRef?: React.Ref<TextInput>;
}

export function SearchField({
  onSearch,
  onChangeText,
  debounceMs = 150,
  placeholder = strings.search.placeholder,
  inputRef,
  value: controlledValue,
  defaultValue = '',
  onSubmitEditing,
  style,
  ...inputProps
}: SearchFieldProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = controlledValue ?? internalValue;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValue = useRef<string | null>(null);
  const currentValue = useRef(value);
  currentValue.current = value;
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [debounceMs]);

  useEffect(() => {
    if (controlledValue !== undefined && pendingValue.current !== controlledValue && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [controlledValue]);

  const handleChange = (text: string) => {
    if (controlledValue === undefined) setInternalValue(text);
    currentValue.current = text;
    pendingValue.current = text;
    onChangeText?.(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!text || debounceMs <= 0) onSearch(text);
    else timerRef.current = setTimeout(() => { timerRef.current = null; onSearchRef.current(text); }, debounceMs);
  };

  const handleClear = () => {
    handleChange('');
  };

  return (
    <View
      style={[
        styles.container,
        {
          height: 44,
          borderRadius: theme.radius.full,
          paddingLeft: theme.space[3],
        },
      ]}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        top: 2, bottom: 2, borderRadius: theme.radius.full, backgroundColor: c.bg.surface,
      }]} />
      <Icon name="action.search" size="sm" color={c.text.muted} />

      <TextInput
        {...inputProps}
        ref={inputRef}
        style={[
          styles.input,
          { ...textStyle(theme.typeTokens.bodyMd), color: c.text.primary }, style,
        ]}
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={c.text.muted}
        returnKeyType="search"
        clearButtonMode="never"
        accessibilityRole="search"
        accessibilityLabel={inputProps.accessibilityLabel ?? placeholder}
        onSubmitEditing={(event) => {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = null;
          onSearch(currentValue.current);
          onSubmitEditing?.(event);
        }}
      />

      {value.length > 0 ? (
        <Pressable
          onPress={handleClear}
          accessibilityLabel={strings.search.clear}
          accessibilityRole="button"
          style={styles.clearButton}
        >
          <Icon name="nav.close" size="sm" color={c.text.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
