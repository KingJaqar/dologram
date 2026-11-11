/** Text style generator using theme tokens (12.2, D-130). */
import type { TypeToken } from './tokens';

/** Font family name constants matching @expo-google-fonts package exports. */
export const fontFamilies = {
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
  JetBrainsMono_400Regular: 'JetBrainsMono_400Regular',
} as const;

export type FontFamily = keyof typeof fontFamilies;

/** Maps weight + family to the Expo Google Fonts family string (12.10). */
function toFontFamily(family: string, weight: number): string {
  if (family.toLowerCase().includes('jetbrains') || family.toLowerCase().includes('mono')) {
    return fontFamilies.JetBrainsMono_400Regular;
  }
  if (weight >= 700) return fontFamilies.Inter_700Bold;
  if (weight >= 600) return fontFamilies.Inter_600SemiBold;
  if (weight >= 500) return fontFamilies.Inter_500Medium;
  return fontFamilies.Inter_400Regular;
}

/**
 * Returns a React Native text style from a TypeToken object.
 * Always use named TypeToken objects from packages/shared/src/theme/tokens.ts.
 */
export function textStyle(
  token: TypeToken,
): { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing: number } {
  return {
    fontFamily: toFontFamily(token.family, token.weight),
    fontSize: token.size,
    lineHeight: token.lineHeight,
    letterSpacing: token.letterSpacing,
  };
}

/**
 * Cap for text that should not exceed a multiplier.
 * Top bars, folder tabs, badges and status captions: 1.5x.
 * Message text, rows, dialogs and sheets: no cap (12.2, D-130).
 */
export const maxFontSizeMultiplier = 1.5;
