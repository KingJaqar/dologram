import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { strings } from '@dologram/shared';
import { textStyle } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';

export const SearchProgress = React.memo(function SearchProgress({ label = strings.search.searching, rows = 3 }: { label?: string; rows?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.container} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <Text style={[textStyle(theme.typeTokens.bodySm), { color: theme.colors.text.secondary }]}>{label}</Text>
      <View style={styles.rows} accessibilityElementsHidden>
        {Array.from({ length: rows }, (_, index) => (
          <View key={index} style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: theme.colors.skeleton.base }]} />
            <View style={styles.body}>
              <View style={[styles.title, { backgroundColor: theme.colors.skeleton.base }]} />
              <View style={[styles.preview, { backgroundColor: theme.colors.skeleton.base }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  rows: { gap: 2 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  body: { flex: 1, gap: 8 },
  title: { width: '42%', height: 13, borderRadius: 4 },
  preview: { width: '72%', height: 11, borderRadius: 4 },
});
