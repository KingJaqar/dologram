/**
 * ThemeProvider and useTheme hook for DoloGram (12.10, D-83, D-134).
 * Persists the theme setting to AsyncStorage key `dg.theme`.
 * Reads reduceMotion from AccessibilityInfo and listens for changes.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  color,
  space,
  radius,
  elevation,
  motion,
  z,
  typeTokens,
  avatarFills,
} from '@dologram/shared';
import type {
  TypeTokenKey,
} from '@dologram/shared';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

/** The resolved color palette for the current scheme. */
export type ThemeColors = (typeof color)['light'] | (typeof color)['dark'];

export interface ThemeContextValue {
  /** Resolved colors for the current scheme. */
  colors: ThemeColors;
  /** Named type tokens, e.g. theme.typeTokens.bodyLg */
  typeTokens: typeof typeTokens;
  avatarFills: typeof avatarFills;
  space: typeof space;
  radius: typeof radius;
  /** Elevation level → { android, shadowOpacityLight, shadowOpacityDark } */
  elevation: typeof elevation;
  motion: typeof motion;
  z: typeof z;
  /** Resolved color scheme ("light" | "dark"). */
  scheme: ColorScheme;
  /** User-chosen setting ("system" | "light" | "dark"). */
  setting: ThemeSetting;
  setSetting: (setting: ThemeSetting) => void;
  /** True when the platform "Remove animations" preference is on. */
  reduceMotion: boolean;
  /** Helper: get a duration value, collapsed to instant when reduceMotion */
  duration: (key: keyof typeof motion.duration, allowFade?: boolean) => number;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'dg.theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [setting, setSetting] = useState<ThemeSetting>('system');
  const [reduceMotion, setReduceMotion] = useState(false);

  // Load persisted setting
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setSetting(val);
      }
    }).catch(() => {
      // Fallback to "system" already set
    });
  }, []);

  // Persist setting changes
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, setting).catch(() => {
      // AsyncStorage failure: silent, setting is still in state
    });
  }, [setting]);

  // Reduce motion
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((val) => {
      if (!cancelled) setReduceMotion(val);
    }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const scheme: ColorScheme =
    setting === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : setting;

  const colors: ThemeColors = color[scheme];

  function updateSetting(s: ThemeSetting) {
    setSetting(s);
  }

  // Duration helper: collapses to instant (or fast for opacity fades) under reduceMotion
  function duration(key: keyof typeof motion.duration, allowFade = false): number {
    if (!reduceMotion) return motion.duration[key];
    return allowFade ? motion.duration.reduceMotion : motion.duration.instant;
  }

  const value: ThemeContextValue = {
    colors,
    typeTokens,
    avatarFills,
    space,
    radius,
    elevation,
    motion,
    z,
    scheme,
    setting,
    setSetting: updateSetting,
    reduceMotion,
    duration,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Hook to consume the theme context. Must be used inside ThemeProvider. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

// Re-export TypeTokenKey so components can use it without importing shared directly
export type { TypeTokenKey };
