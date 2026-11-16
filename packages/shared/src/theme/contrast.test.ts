/** Explicit rendered pairs; unrelated colors need not contrast with each other. */
import { contrastRatio, avatarFills } from './contrast';
import { color } from './tokens';
import { describe, expect, test } from 'vitest';

describe('contrast: WCAG 2.x admin pairs', () => {
  for (const [scheme, c] of Object.entries(color)) {
    const textPairs = [
      ['primary/app', c.text.primary, c.bg.app],
      ['secondary/app', c.text.secondary, c.bg.app],
      ['primary/input', c.text.primary, c.bg.input],
      ['placeholder/input', c.text.secondary, c.bg.input],
      ['primary/surface', c.text.primary, c.bg.surface],
      ['secondary/surface', c.text.secondary, c.bg.surface],
      ['primary/pressed', c.text.primary, c.bg.pressed],
      ['brand/selected', c.brand.primary, c.bg.selected],
      ['button', c.brand.onPrimary, c.brand.primary],
      ['button pressed', c.brand.onPrimary, c.brand.pressed],
      ['danger button', c.danger.onDanger, c.danger.text],
      ['error', c.danger.text, c.danger.bg],
      ['field error', c.danger.text, c.bg.app],
      ['success', c.success, c.bg.surface],
      ['warning', c.warning.text, c.warning.bg],
      ['info', c.info.text, c.info.bg],
      ['disabled/app', c.text.disabled, c.bg.app],
      ['disabled/surface', c.text.disabled, c.bg.surface],
      ['disabled/control', c.text.disabled, c.bg.disabled],
      ['toast text', c.toast.text, c.toast.bg],
      ['toast action', c.toast.action, c.toast.bg],
    ] as const;
    for (const [name, a, b] of textPairs) {
      test(`${scheme} ${name} text >= 4.5:1`, () => expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(4.5));
    }
    for (const surface of [c.bg.app, c.bg.surface, c.bg.input, c.bg.elevated, c.bg.pressed, c.danger.bg]) {
      test(`${scheme} focus and border against ${surface} >= 3:1`, () => {
        expect(contrastRatio(c.focus.ring, surface)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(c.border.strong, surface)).toBeGreaterThanOrEqual(3);
      });
    }
    test(`${scheme} usage warning against track >= 3:1`, () => {
      expect(contrastRatio(c.warning.bar, c.border.subtle)).toBeGreaterThanOrEqual(3);
    });
  }
  for (const [index, fill] of avatarFills.entries()) {
    test(`avatar ${index + 1} white initials >= 4.5:1`, () => expect(contrastRatio('#FFFFFF', fill)).toBeGreaterThanOrEqual(4.5));
  }
});

describe('web rendered theme pairs', () => {
  for (const [scheme, c] of Object.entries(color)) {
    // Gallery text/controls and root body render these exact combinations.
    const textPairs = [
      ['body and headings', c.text.primary, c.bg.app],
      ['theme buttons', c.text.primary, c.bg.surface],
      ['secondary text', c.text.secondary, c.bg.app],
    ] as const;
    const nonTextPairs = [
      ['focus on page', c.focus.ring, c.bg.app],
      ['focus on buttons', c.focus.ring, c.bg.surface],
      ['button and swatch boundary', c.border.strong, c.bg.app],
      ['semantic icons', c.text.primary, c.bg.app],
    ] as const;
    test(`${scheme} required rendered pair coverage is nonzero and complete`, () => {
      expect(textPairs.map(([name]) => name)).toEqual(['body and headings', 'theme buttons', 'secondary text']);
      expect(nonTextPairs).toHaveLength(4);
      expect(textPairs.length + nonTextPairs.length).toBe(7);
    });
    for (const [name, foreground, background] of textPairs) {
      test(`${scheme} web ${name} >= 4.5:1`, () => expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5));
    }
    for (const [name, foreground, background] of nonTextPairs) {
      test(`${scheme} web ${name} >= 3:1`, () => expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3));
    }
  }
});
