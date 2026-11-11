/** WCAG 2.x contrast utility for the DoloGram theme (D-95). */
export { avatarFills } from './tokens';

/** Contrast ratio = (L1 + 0.05) / (L2 + 0.05) where L is relative luminance. */
export function contrastRatio(hex1: string, hex2: string): number {
  const relativeLuminance = (hex: string): number => {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    const r = ((bigint >> 16) & 255) / 255;
    const g = ((bigint >> 8) & 255) / 255;
    const b = (bigint & 255) / 255;

    const toLinear = (c: number) => {
      if (c <= 0.03928) return c / 12.92;
      return Math.pow((c + 0.055) / 1.055, 2.4);
    };

    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };

  const L1 = relativeLuminance(hex1);
  const L2 = relativeLuminance(hex2);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

/** Checks if the contrast ratio between two hex colors meets the minimum threshold. */
export function passesContrast(hex1: string, hex2: string, minRatio: number = 4.5): boolean {
  return contrastRatio(hex1, hex2) >= minRatio;
}
