import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../components/Button';
import { SearchField, type SearchFieldProps } from '../components/SearchField';
import { useTheme } from '../theme/ThemeProvider';

export function SearchToolbar({ onBack, ...fieldProps }: SearchFieldProps & {
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const left = insets.left + 52;
  const right = insets.right + 12;
  return (
    <View style={[styles.toolbar, { marginTop: insets.top }]}>
      <View style={{ marginLeft: insets.left + 4 }}>
        <IconButton iconName="nav.back" accessibilityLabel="Go back" onPress={onBack} />
      </View>
      <View style={[styles.field, { left, right }]}>
        <SearchField {...fieldProps} surfaceColor={colors.bg.surface} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { height: 56, justifyContent: 'center', alignItems: 'flex-start' },
  field: { position: 'absolute', top: 6 },
});
