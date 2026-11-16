import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Avatar } from '../components/Avatar';
import { usePressHighlight } from '../hooks/usePressHighlight';
import { HighlightedText } from './HighlightedText';

export type SearchResultRowProps = {
  title: string; subtitle: string; query: string; onPress: () => void;
  avatarUrl?: string | null; isGroup?: boolean;
  avatarId?: string; savedMessages?: boolean; metadata?: string; disabled?: boolean;
};

/** Shared name, conversation-summary and scoped-snippet presentation. */
export const SearchResultRow = React.memo(function SearchResultRow({ title, subtitle, query, onPress, avatarId, avatarUrl, isGroup, savedMessages, metadata, disabled = false }: SearchResultRowProps) {
  const theme = useTheme();
  const { style: highlightStyle, onPressIn, onPressOut } = usePressHighlight(theme.reduceMotion);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[title, metadata, subtitle].filter(Boolean).join(', ')}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
      style={[styles.row, { backgroundColor: theme.colors.bg.app, borderBottomColor: theme.colors.separator }]}>
      <Reanimated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg.pressed }, highlightStyle]}
      />
      {avatarId ? <Avatar id={avatarId} displayName={title} imageUrl={avatarUrl} imageBucket={isGroup ? 'chat-avatars' : 'avatars'} size={48} isSavedMessages={savedMessages} /> : null}
      <View style={styles.body}>
        <HighlightedText text={title} query={query} style={textStyle(theme.typeTokens.titleSm)} />
        {metadata ? <Text style={[textStyle(theme.typeTokens.labelMd), { color: theme.colors.text.secondary }]}>{metadata}</Text> : null}
        <HighlightedText text={subtitle} query={query} numberOfLines={2} style={[textStyle(theme.typeTokens.bodyMd), { color: theme.colors.text.secondary }]} />
      </View>
    </Pressable>
  );
}, (previous, next) => (
  previous.title === next.title &&
  previous.subtitle === next.subtitle &&
  previous.query === next.query &&
  previous.metadata === next.metadata &&
  previous.disabled === next.disabled &&
  previous.avatarId === next.avatarId &&
  previous.avatarUrl === next.avatarUrl &&
  previous.isGroup === next.isGroup &&
  previous.savedMessages === next.savedMessages &&
  previous.onPress === next.onPress
));

const styles = StyleSheet.create({
  row: { minHeight: 72, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  body: { flex: 1, gap: 2 },
});
