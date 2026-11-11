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

export interface SearchFieldProps extends Omit<TextInputProps, 'onChangeText'> {
  /** Called ~150 ms after the user stops typing. */
  onSearch: (query: string) => void;
  debounceMs?: number;
  inputRef?: React.Ref<TextInput>;
}

export function SearchField({
  onSearch,
  debounceMs = 150,
  placeholder = 'Search',
  inputRef,
  ...inputProps
}: SearchFieldProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [value, setValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (text: string) => {
    setValue(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (debounceMs === 0) onSearch(text);
    else timerRef.current = setTimeout(() => onSearch(text), debounceMs);
  };

  const handleClear = () => {
    setValue('');
    if (timerRef.current) clearTimeout(timerRef.current);
    onSearch('');
  };

  return (
    <View
      style={[
        styles.container,
        {
          height: 40,
          borderRadius: theme.radius.full,
          backgroundColor: c.bg.surface,
          paddingHorizontal: theme.space[3],
        },
      ]}
    >
      <Icon name="action.search" size="sm" color={c.text.muted} />

      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          { ...textStyle(theme.typeTokens.bodyMd), color: c.text.primary },
        ]}
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={c.text.muted}
        returnKeyType="search"
        clearButtonMode="never"
        accessibilityRole="search"
        {...inputProps}
      />

      {value.length > 0 ? (
        <Pressable
          onPress={handleClear}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          style={styles.clearButton}
          hitSlop={8}
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
  clearButton: { padding: 2 },
});
