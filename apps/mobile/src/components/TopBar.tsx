/**
 * CMP-21: Top bar — height 56 + status bar inset.
 * Back button on non-root screens, title in title.md, wordmark in title.lg on AND-03.
 * maxFontSizeMultiplier 1.5 (12.2, D-130).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { IconButton } from './Button';

export interface TopBarProps {
  title?: string;
  subtitle?: string;
  /** When true, renders the wordmark style (AND-03 chat list). */
  wordmark?: boolean;
  onBack?: () => void;
  /** Content rendered in the right side. */
  right?: React.ReactNode;
  /** Content rendered left of the title (e.g. Low Signal chip). */
  left?: React.ReactNode;
  /** Allows a root screen to place a complete navigation group on the left. */
  leftWide?: boolean;
  horizontalPadding?: number;
  /** Aligns the title to the leading edge instead of centering it. */
  titleAlign?: 'center' | 'left';
}

export function TopBar({ title, subtitle, wordmark = false, onBack, right, left, leftWide = false, horizontalPadding = 4, titleAlign = 'center' }: TopBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;

  const titleStyle = wordmark
    ? { ...textStyle(theme.typeTokens.titleLg), color: c.brand.primary }
    : { ...textStyle(theme.typeTokens.titleMd), color: c.text.primary };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: c.bg.chatList,
          borderBottomColor: c.separator,
        },
      ]}
    >
      <View style={[styles.inner, { paddingHorizontal: horizontalPadding }]}>
        {/* Left side */}
        <View style={[styles.side, leftWide && styles.wideSide]}>
          {onBack ? (
            <IconButton
              iconName="nav.back"
              accessibilityLabel="Go back"
              onPress={onBack}
              iconSize="md"
            />
          ) : null}
          {left}
        </View>

        {/* Title */}
        {title || subtitle ? (
          <View style={[styles.titleArea, titleAlign === 'left' && styles.titleAreaLeft]}>
            {title ? (
              <Text
                style={titleStyle}
                numberOfLines={1}
                maxFontSizeMultiplier={1.5}
              >
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text
                style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Right side */}
        <View style={[styles.side, styles.rightSide]}>
          {right}
        </View>
      </View>
    </View>
  );
}

const BAR_HEIGHT = 56;

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  wideSide: {
    width: 'auto',
    flex: 0,
    justifyContent: 'flex-start',
  },
  rightSide: {
    width: 'auto',
    minWidth: 48,
    flexShrink: 0,
  },
  titleArea: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  titleAreaLeft: {
    alignItems: 'flex-start',
  },
});
