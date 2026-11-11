/**
 * Design tokens from v14 Section 12.2.
 * One source of truth: every screen imports from here.
 * D-138: no color literal is allowed outside this file.
 */

// ─── Color ────────────────────────────────────────────────────────────────────

/**
 * DoloGram's two brand colors. Each mode uses one as its theme color and the
 * other as its accent, so the palette stays recognizable in both modes.
 */
export const dologramColors = {
  deepCharcoal: '#1D1C1C',
  warmIvory: '#EDE8D0',
} as const;

export const color = {
  light: {
    bg: {
      app: dologramColors.warmIvory,
      chat: '#F3EFD9',
      chatList: dologramColors.warmIvory,
      input: '#F7F3E2',
      surface: '#F9F6E8',
      elevated: '#FCFAF2',
      pressed: '#DDD8BF',
      overlay: 'rgba(0,0,0,0.04)',
    },
    text: {
      primary: dologramColors.deepCharcoal,
      secondary: '#514F4A',
      muted: '#817E74',
      inverse: dologramColors.warmIvory,
    },
    brand: {
      primary: dologramColors.deepCharcoal,
      pressed: '#0F0F0F',
    },
    bubble: {
      outgoing: dologramColors.deepCharcoal,
      outgoingText: dologramColors.warmIvory,
      incoming: '#FCFAF2',
      incomingText: dologramColors.deepCharcoal,
      join: '#E4DFC5',
      joinText: '#514F4A',
      savedOutgoing: dologramColors.deepCharcoal,
      savedOutgoingText: dologramColors.warmIvory,
    },
    badge: {
      unread: { bg: dologramColors.deepCharcoal, text: dologramColors.warmIvory },
      muted: { bg: '#94A3B8', text: '#FFFFFF' },
    },
    info: {
      bg: '#EFF6FF',
      text: '#1D4ED8',
    },
    warning: {
      bg: '#FFFBEB',
      text: '#92400E',
    },
    error: {
      bg: '#FEF2F2',
      text: '#B91C1C',
    },
    media: {
      bg: '#0F172A',
      text: '#F1F5F9',
    },
    separator: '#E2E8F0',
    scrim: 'rgba(0,0,0,0.48)',
    shadow: '#000000',
    tab: {
      active: dologramColors.deepCharcoal,
      inactive: '#94A3B8',
    },
    skeleton: {
      base: '#DDD8BF',
      highlight: '#FCFAF2',
    },
  },
  dark: {
    bg: {
      app: dologramColors.deepCharcoal,
      chat: '#252323',
      chatList: dologramColors.deepCharcoal,
      input: '#302E2E',
      surface: '#252323',
      elevated: '#383535',
      pressed: '#302E2E',
      overlay: 'rgba(255,255,255,0.06)',
    },
    text: {
      primary: dologramColors.warmIvory,
      secondary: '#D8D3BD',
      muted: '#B2AE9C',
      inverse: dologramColors.deepCharcoal,
    },
    brand: {
      primary: dologramColors.warmIvory,
      pressed: '#D8D3BD',
    },
    bubble: {
      outgoing: dologramColors.warmIvory,
      outgoingText: dologramColors.deepCharcoal,
      incoming: '#252323',
      incomingText: dologramColors.warmIvory,
      join: '#4A4635',
      joinText: dologramColors.warmIvory,
      savedOutgoing: dologramColors.warmIvory,
      savedOutgoingText: dologramColors.deepCharcoal,
    },
    badge: {
      unread: { bg: dologramColors.warmIvory, text: dologramColors.deepCharcoal },
      muted: { bg: '#475569', text: '#CBD5E1' },
    },
    info: {
      bg: '#1E3A5F',
      text: '#93C5FD',
    },
    warning: {
      bg: '#3D2A00',
      text: '#FCD34D',
    },
    error: {
      bg: '#3D0000',
      text: '#FCA5A5',
    },
    media: {
      bg: '#0F172A',
      text: '#F1F5F9',
    },
    separator: '#1E293B',
    scrim: 'rgba(0,0,0,0.72)',
    shadow: '#000000',
    tab: {
      active: dologramColors.warmIvory,
      inactive: '#475569',
    },
    skeleton: {
      base: '#302E2E',
      highlight: '#383535',
    },
  },
} as const;

export type ColorScheme = 'light' | 'dark';
export type ColorToken = string;

// ─── Avatar fills ─────────────────────────────────────────────────────────────

/**
 * Avatar fill colors (7 fills in index order).
 * Each passes WCAG 2.x 4.5:1 contrast against #FFFFFF (for white initials).
 * Verified ratios: #1D4ED8 6.70, #6D28D9 7.10, #BE185D 6.04,
 *   #B91C1C 6.47, #92400E 7.09, #065F46 7.68, #374151 10.31
 */
export const avatarFills = [
  '#1D4ED8',
  '#6D28D9',
  '#BE185D',
  '#B91C1C',
  '#92400E',
  '#065F46',
  '#374151',
] as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export interface TypeToken {
  family: string;
  weight: number;
  size: number;
  lineHeight: number;
  letterSpacing: number;
}

/**
 * Named type tokens (v14 12.2).
 * Use these constants rather than raw TypeToken objects in components.
 */
export const typeTokens = {
  display:    { family: 'Inter', weight: 700, size: 32, lineHeight: 40, letterSpacing: -0.02 },
  heading1:   { family: 'Inter', weight: 600, size: 24, lineHeight: 32, letterSpacing: -0.01 },
  heading2:   { family: 'Inter', weight: 600, size: 20, lineHeight: 28, letterSpacing: -0.01 },
  titleLg:    { family: 'Inter', weight: 700, size: 18, lineHeight: 24, letterSpacing: 0 },
  titleMd:    { family: 'Inter', weight: 600, size: 16, lineHeight: 22, letterSpacing: 0 },
  titleSm:    { family: 'Inter', weight: 600, size: 15, lineHeight: 20, letterSpacing: 0 },
  bodyLg:     { family: 'Inter', weight: 400, size: 16, lineHeight: 24, letterSpacing: 0 },
  bodyMd:     { family: 'Inter', weight: 400, size: 14, lineHeight: 20, letterSpacing: 0 },
  bodySm:     { family: 'Inter', weight: 400, size: 12, lineHeight: 16, letterSpacing: 0 },
  labelLg:    { family: 'Inter', weight: 500, size: 14, lineHeight: 20, letterSpacing: 0.01 },
  labelMd:    { family: 'Inter', weight: 500, size: 12, lineHeight: 16, letterSpacing: 0.02 },
  mono:       { family: 'JetBrains Mono', weight: 400, size: 14, lineHeight: 18, letterSpacing: 0 },
  monoSm:     { family: 'JetBrains Mono', weight: 400, size: 12, lineHeight: 16, letterSpacing: 0 },
} as const satisfies Record<string, TypeToken>;

export type TypeTokenKey = keyof typeof typeTokens;

// ─── Space ───────────────────────────────────────────────────────────────────

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 48,
} as const;

export type SpaceToken = typeof space;

// ─── Radius ──────────────────────────────────────────────────────────────────

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
  bubble: 22,
  bubbleJoin: 4,
  full: 9999,
} as const;

export type RadiusToken = typeof radius;

// ─── Elevation ───────────────────────────────────────────────────────────────

export const elevation = {
  0: { android: 0, shadowOpacityLight: 0, shadowOpacityDark: 0 },
  1: { android: 1, shadowOpacityLight: 0.06, shadowOpacityDark: 0.24 },
  2: { android: 2, shadowOpacityLight: 0.10, shadowOpacityDark: 0.32 },
  3: { android: 4, shadowOpacityLight: 0.16, shadowOpacityDark: 0.48 },
} as const;

export interface ElevationToken {
  android: number;
  shadowOpacityLight: number;
  shadowOpacityDark: number;
}

// ─── Motion ──────────────────────────────────────────────────────────────────

export const motion = {
  duration: {
    instant: 0,
    fast: 100,
    normal: 200,
    loading: 300,
    modal: 300,
    toast: 4000,
    toastClose: 6000,
    spinner: 1000,
    reduceMotion: 100,
  },
  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    standard: 'ease',
  },
  delay: {
    loading: 300,
  },
  toast: {
    duration: 4000,
    durationLong: 6000,
  },
} as const;

export type MotionDurationToken = typeof motion.duration;

// ─── Z-index ─────────────────────────────────────────────────────────────────

export const z = {
  base: 0,
  banner: 10,
  overlay: 100,
  sheet: 200,
  dialog: 300,
  toast: 1000,
} as const;

export type ZToken = typeof z;

// ─── Convenience bundle ──────────────────────────────────────────────────────

export const tokens = {
  dologramColors,
  color,
  avatarFills,
  typeTokens,
  space,
  radius,
  elevation,
  motion,
  z,
} as const;
