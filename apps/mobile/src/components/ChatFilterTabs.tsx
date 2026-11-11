/** Filter tabs for the main chat list. */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { strings } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';

export type ChatFilter = 'all' | 'unread' | 'groups' | 'starred';

export interface ChatFilterTabsProps {
  activeFilter: ChatFilter;
  onSelect: (filter: ChatFilter) => void;
}

export function ChatFilterTabs({ activeFilter, onSelect }: ChatFilterTabsProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View
      style={[styles.bar, { backgroundColor: c.bg.chatList, borderBottomColor: c.separator }]}
      accessibilityRole="tablist"
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {([
          ['all', strings.chatList.all],
          ['unread', strings.chatList.unread],
          ['groups', strings.chatList.groups],
          ['starred', strings.chatList.starred],
        ] as const).map(([filter, label]) => (
          <FilterTab
            key={filter}
            label={label}
            active={activeFilter === filter}
            onPress={() => onSelect(filter)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FilterTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const activeProgress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(activeProgress, {
      toValue: active ? 1 : 0,
      duration: theme.duration('normal'),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, activeProgress, theme]);

  const activeScale = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  return (
    <Pressable
      hitSlop={2}
      style={({ pressed }) => [
        styles.tab,
        pressed ? { backgroundColor: c.bg.pressed } : null,
      ]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.activePill,
          {
            backgroundColor: c.bg.surface,
            opacity: activeProgress,
            transform: [{ scale: activeScale }],
          },
        ]}
      />
      <Text
        style={[
          textStyle(theme.typeTokens.labelMd),
          styles.tabLabel,
          { color: active ? c.text.primary : c.text.secondary },
        ]}
        maxFontSizeMultiplier={1.5}
      >
        {label}
      </Text>
      <Animated.View
        pointerEvents="none"
        style={[styles.indicator, { backgroundColor: c.brand.primary, opacity: activeProgress }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 18,
    maxWidth: 160,
  },
  activePill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 18,
  },
  tabLabel: {
    textAlign: 'center',
    maxWidth: 128,
  },
  indicator: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 2,
    height: 4,
    borderRadius: 2,
  },
});
