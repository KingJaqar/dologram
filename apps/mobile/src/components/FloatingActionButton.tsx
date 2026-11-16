import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Icon } from './Icon';
import { ThemePressable as Pressable, ThemeText as Text } from '../theme/ThemeSurface';

const MENU_DURATION = 260;

export interface FloatingAction {
  label: string;
  iconName: string;
  onPress: () => void;
}

interface FloatingActionButtonProps {
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}

export function FloatingActionButton({ accessibilityLabel, onPress, disabled = false }: FloatingActionButtonProps) {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.container, { right: insets.right + 16, bottom: insets.bottom + 16 }]}>
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: pressed && !disabled ? c.brand.pressed : c.brand.primary, opacity: disabled ? 0.5 : 1, shadowColor: c.shadow },
        ]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
      >
        <Icon name="nav.new" size="md" color={c.text.inverse} />
      </Pressable>
    </View>
  );
}

export function FloatingActionMenu({ actions, accessibilityLabel = 'New', disabled = false }: { actions: readonly FloatingAction[]; accessibilityLabel?: string; disabled?: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);
  const animateTo = (next: number) => {
    progress.value = withTiming(next, {
      duration: theme.reduceMotion ? 0 : MENU_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  };
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 45}deg` }],
  }));

  return (
    <View pointerEvents="box-none" style={[styles.container, { right: insets.right + 16, bottom: insets.bottom + 16 }]}>
      <View
        style={styles.options}
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      >
        {actions.map((action, index) => (
          <FloatingActionOption
            key={action.label}
            action={action}
            index={index}
            actionCount={actions.length}
            progress={progress}
            onPress={() => {
              setOpen(false);
              animateTo(0);
              action.onPress();
            }}
            color={c.text.primary}
            pressedColor={c.bg.pressed}
            elevatedColor={c.bg.elevated}
            separatorColor={c.separator}
            shadowColor={c.shadow}
            labelStyle={textStyle(theme.typeTokens.labelMd)}
          />
        ))}
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: pressed && !disabled ? c.brand.pressed : c.brand.primary, opacity: disabled ? 0.5 : 1, shadowColor: c.shadow },
        ]}
        onPress={() => {
          const next = !open;
          setOpen(next);
          animateTo(next ? 1 : 0);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, expanded: open }}
      >
        <Animated.View style={iconStyle}>
          <Icon name="nav.new" size="md" color={c.text.inverse} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

function FloatingActionOption({
  action,
  index,
  actionCount,
  progress,
  onPress,
  color,
  pressedColor,
  elevatedColor,
  separatorColor,
  shadowColor,
  labelStyle,
}: {
  action: FloatingAction;
  index: number;
  actionCount: number;
  progress: SharedValue<number>;
  onPress: () => void;
  color: string;
  pressedColor: string;
  elevatedColor: string;
  separatorColor: string;
  shadowColor: string;
  labelStyle: ReturnType<typeof textStyle>;
}) {
  const reverseIndex = actionCount - index - 1;
  const delay = reverseIndex * 0.1;
  const style = useAnimatedStyle(() => {
    const localProgress = Math.max(0, Math.min(1, (progress.value - delay) / (1 - delay)));
    return {
      opacity: localProgress,
      transform: [
        { translateY: (1 - localProgress) * 14 },
        { scale: 0.96 + localProgress * 0.04 },
      ],
    };
  });

  return (
    <Animated.View style={style}>
      <Pressable
        style={({ pressed }) => [
          styles.option,
          {
            backgroundColor: pressed ? pressedColor : elevatedColor,
            borderColor: separatorColor,
            shadowColor,
          },
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={action.label}
      >
        <Icon name={action.iconName} size="sm" color={color} />
        <Text style={[labelStyle, { color }]}>{action.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'flex-end',
    zIndex: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowOpacity: 0.24,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  options: {
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 12,
  },
  option: {
    minHeight: 48,
    maxWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 3,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
