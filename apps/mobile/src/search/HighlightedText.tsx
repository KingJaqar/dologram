import React, { useMemo } from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { memoizedHighlightRanges } from './matching';

/** Plain-text snippets only. Markdown integration belongs to MessageText's renderer. */
export function HighlightedText({ text, query, style, ...props }: TextProps & { text: string; query: string }) {
  const theme = useTheme();
  const ranges = useMemo(() => memoizedHighlightRanges(text, query), [query, text]);
  const parts = useMemo(() => {
    const next: React.ReactNode[] = [];
    let offset = 0;
    for (const range of ranges) {
      if (range.start > offset) next.push(text.slice(offset, range.start));
      next.push(<Text key={`${range.start}-${range.end}`} style={{ backgroundColor: theme.colors.brand.primary, color: theme.colors.text.inverse }}>{text.slice(range.start, range.end)}</Text>);
      offset = range.end;
    }
    next.push(text.slice(offset));
    return next;
  }, [ranges, text, theme.colors.brand.primary, theme.colors.text.inverse]);
  return <Text {...props} style={[{ color: theme.colors.text.primary }, style]}>{parts}</Text>;
}
