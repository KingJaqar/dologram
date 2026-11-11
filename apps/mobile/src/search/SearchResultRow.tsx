import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Avatar } from '../components/Avatar';
import { HighlightedText } from './HighlightedText';

export type SearchResultRowProps = {
  title: string; subtitle: string; query: string; onPress: () => void;
  avatarId?: string; savedMessages?: boolean; metadata?: string; disabled?: boolean;
};

/** Shared name, conversation-summary and scoped-snippet presentation. */
export function SearchResultRow({ title, subtitle, query, onPress, avatarId, savedMessages, metadata, disabled = false }: SearchResultRowProps) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[title, metadata, subtitle].filter(Boolean).join(', ')}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.colors.bg.pressed : theme.colors.bg.app }]}>
      {avatarId ? <Avatar id={avatarId} displayName={title} size={48} isSavedMessages={savedMessages} /> : null}
      <View style={styles.body}>
        <HighlightedText text={title} query={query} style={textStyle(theme.typeTokens.titleSm)} />
        {metadata ? <Text style={[textStyle(theme.typeTokens.labelMd), { color: theme.colors.text.secondary }]}>{metadata}</Text> : null}
        <HighlightedText text={subtitle} query={query} numberOfLines={2} style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.text.secondary }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 72, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1, gap: 4 },
});
