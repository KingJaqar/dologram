/** Shared chat and folder filter-tab presentation and selection transition. */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type AccessibilityRole,
  type LayoutRectangle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { ThemeSurface, ThemeText as Text, themeColorTransition } from '../theme/ThemeSurface';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';

interface FilterTabsProps<T extends string | null> {
  tabs: readonly { value: T; label: string; iconName?: string }[];
  activeValue: T;
  onSelect: (value: T) => void;
  trailing?: React.ReactNode;
  indicatorTestID?: string;
  accessibilityRole?: AccessibilityRole;
  barStyle?: StyleProp<ViewStyle>;
  rowStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollStyle?: StyleProp<ViewStyle>;
  onScrollabilityChange?: (needed: boolean) => void;
}

// A duration-based spring keeps the underline on one predictable 260ms
// timeline. The damping ratio allows one restrained overshoot before settling
// without the repeated oscillation of a loose spring.
const FILTER_SPRING = { duration: 260, dampingRatio: 0.86 };

export function FilterTabs<T extends string | null>({
  tabs,
  activeValue,
  onSelect,
  trailing,
  indicatorTestID,
  accessibilityRole = 'tab',
  barStyle,
  rowStyle,
  contentContainerStyle,
  scrollStyle,
  onScrollabilityChange,
}: FilterTabsProps<T>) {
  const theme = useTheme();
  const c = theme.colors;
  const [layouts, setLayouts] = useState<ReadonlyMap<T, LayoutRectangle>>(() => new Map());
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const previousFilter = useRef<{ value: T } | null>(null);
  const indicator = useSharedValue([0, 0]);
  const layout = layouts.get(activeValue);

  useEffect(() => {
    if (viewportWidth <= 0 || contentWidth <= 0) return;
    onScrollabilityChange?.(contentWidth > viewportWidth + 1);
  }, [contentWidth, onScrollabilityChange, viewportWidth]);

  useLayoutEffect(() => {
    if (!layout) return;
    const target = [layout.x + layout.width / 2, Math.max(0, layout.width - 24)];
    const switching = previousFilter.current !== null && previousFilter.current.value !== activeValue;
    previousFilter.current = { value: activeValue };
    // Initial measurement and size changes snap into place. Only selection
    // changes animate, retargeting the same UI-thread timeline on rapid taps.
    indicator.set(switching && !theme.reduceMotion ? withSpring(target, FILTER_SPRING) : target);
  }, [activeValue, layout, indicator, theme.reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicator.value[1] > 0 ? 1 : 0,
    transform: [
      { translateX: indicator.value[0] - 12 },
      { scaleX: indicator.value[1] / 24 },
    ],
  }));

  return (
    <ThemeSurface
      style={[styles.bar, { backgroundColor: c.bg.chatList, borderBottomColor: c.separator }, barStyle]}
      accessibilityRole="tablist"
    >
      <ScrollView
        horizontal
        style={scrollStyle}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContentWidth(width)}
        contentContainerStyle={[styles.row, contentContainerStyle, rowStyle]}
      >
        {tabs.map(({ value, label, iconName }) => (
          <FilterTab
            key={value ?? "all"}
            label={label}
            iconName={iconName}
            active={activeValue === value}
            onPress={() => { if (activeValue !== value) onSelect(value); }}
            accessibilityRole={accessibilityRole}
            onLayout={(next) => setLayouts((current) => {
              const prior = current.get(value);
              return prior?.x === next.x && prior.width === next.width
                ? current : new Map(current).set(value, next);
            })}
          />
        ))}
        <Animated.View
          testID={indicatorTestID}
          pointerEvents="none"
          style={[styles.indicator, { backgroundColor: c.brand.primary }, indicatorStyle, themeColorTransition(theme.reduceMotion)]}
        />
        {trailing}
      </ScrollView>
    </ThemeSurface>
  );
}

function FilterTab({
  label,
  iconName,
  active,
  onPress,
  accessibilityRole,
  onLayout,
}: {
  label: string;
  iconName?: string;
  active: boolean;
  onPress: () => void;
  accessibilityRole: AccessibilityRole;
  onLayout: (layout: LayoutRectangle) => void;
}) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <Pressable
      hitSlop={2}
      style={({ pressed }) => [
        styles.tab,
        pressed ? { backgroundColor: c.bg.pressed } : null,
      ]}
      onPress={onPress}
      onLayout={(event) => onLayout(event.nativeEvent.layout)}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {iconName ? <Icon name={iconName} size="md" color={active ? c.text.primary : c.text.secondary} /> : null}
      {(!iconName || active) ? <Text
        style={[textStyle(theme.typeTokens.labelMd), styles.tabLabel, { color: active ? c.text.primary : c.text.secondary }]}
        numberOfLines={1} maxFontSizeMultiplier={1.5}
      >{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    height: 43,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginHorizontal: 4,
    maxWidth: 160,
  },
  tabLabel: {
    textAlign: 'center',
    maxWidth: 128,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    width: 24,
    bottom: 5.5,
    height: 4,
    borderRadius: 2,
  },
});
