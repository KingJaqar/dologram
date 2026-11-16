/**
 * ThemeProvider and useTheme hook for DoloGram (12.10, D-83, D-134).
 * Persists the theme setting to AsyncStorage key `dg.theme`.
 * Reads reduceMotion from AccessibilityInfo and listens for changes.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { ThemeMotionProvider, ThemeSurface } from './ThemeSurface';
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

function createDuration(reduceMotion: boolean): ThemeContextValue['duration'] {
  return (key, allowFade = false) => {
    if (!reduceMotion) return motion.duration[key];
    return allowFade ? motion.duration.reduceMotion : motion.duration.instant;
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceScheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [setting, setSetting] = useState<ThemeSetting>('system');
  const scheme: ColorScheme = setting === 'system' ? deviceScheme : setting;
  const [reduceMotion, setReduceMotion] = useState(false);
  const settingLoaded = useRef(false);
  const settingRef = useRef<ThemeSetting>('system');

  // Load persisted setting
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (cancelled || settingLoaded.current) return;
      if (val === 'light' || val === 'dark' || val === 'system') {
        settingRef.current = val;
        setSetting(val);
      }
    }).catch(() => {
      // Fallback to "system" already set
    }).finally(() => {
      if (!cancelled) settingLoaded.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist setting changes
  useEffect(() => {
    if (!settingLoaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, setting).catch(() => {
      // AsyncStorage failure: silent, setting is still in state
    });
  }, [setting]);

  // Reduce motion
  useEffect(() => {
    let cancelled = false;
    let preferenceChanged = false;
    AccessibilityInfo.isReduceMotionEnabled().then((val) => {
      if (!cancelled && !preferenceChanged) setReduceMotion(val);
    }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      preferenceChanged = true;
      setReduceMotion(value);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const colors: ThemeColors = color[scheme];

  const updateSetting = useCallback((s: ThemeSetting) => {
    if (s === settingRef.current) return;
    settingLoaded.current = true;
    settingRef.current = s;
    setSetting(s);
  }, []);

  // Duration helper: collapses to instant (or fast for opacity fades) under reduceMotion
  const duration = useMemo(() => createDuration(reduceMotion), [reduceMotion]);

  const value: ThemeContextValue = useMemo(() => ({
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
  }), [colors, scheme, setting, reduceMotion, updateSetting, duration]);

  return (
    <ThemeContext.Provider value={value}>
      <ThemeMotionProvider value={reduceMotion}>
        <ThemeSurface style={{ flex: 1, backgroundColor: colors.bg.app }}>
          {children}
        </ThemeSurface>
      </ThemeMotionProvider>
    </ThemeContext.Provider>
  );
}

/** Hook to consume the theme context. Must be used inside ThemeProvider. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

// Re-export TypeTokenKey so components can use it without importing shared directly
export type { TypeTokenKey };
