import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { highlightRanges } from './matching';

/** Plain-text snippets only. Markdown integration belongs to MessageText's renderer. */
export function HighlightedText({ text, query, style, ...props }: TextProps & { text: string; query: string }) {
  const theme = useTheme();
  const ranges = highlightRanges(text, query);
  const parts: React.ReactNode[] = [];
  let offset = 0;
  for (const range of ranges) {
    if (range.start > offset) parts.push(text.slice(offset, range.start));
    parts.push(<Text key={range.start} style={{ backgroundColor: theme.colors.brand.primary, color: theme.colors.text.inverse }}>{text.slice(range.start, range.end)}</Text>);
    offset = range.end;
  }
  parts.push(text.slice(offset));
  return <Text {...props} style={[{ color: theme.colors.text.primary }, style]}>{parts}</Text>;
}
