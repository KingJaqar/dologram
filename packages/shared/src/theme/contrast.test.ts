/** WCAG 2.x contrast tests for the DoloGram theme (D-95). */
import { contrastRatio, passesContrast, avatarFills } from './contrast';
import { color } from './tokens';
import { describe, expect, test } from 'vitest';

const light = color.light;
const dark = color.dark;

/** All color token names from the theme. */
const allColorTokens = [
  ...Object.keys(light.bg),
  ...Object.keys(light.text),
  ...Object.keys(dark.bg),
  ...Object.keys(dark.text),
  'avatar.fill1',
  'avatar.fill2',
  'avatar.fill3',
  'avatar.fill4',
  'avatar.fill5',
  'avatar.fill6',
  'avatar.fill7',
] as const;

const textMin = 4.5;
const nonTextMin = 3;

/** Build all color token pairs with their minimum ratio. */
const colorPairs: Array<{ a: string; b: string; hexA: string; hexB: string; min: number }> = [];

allColorTokens.forEach((a) => {
  allColorTokens.forEach((b) => {
    const hexA = (light as any)[a] || (dark as any)[a];
    const hexB = (light as any)[b] || (dark as any)[b];
    if (!hexA || !hexB) return;

    const isText = a.startsWith('text') || b.startsWith('text');
    const min = isText ? textMin : nonTextMin;
    colorPairs.push({ a, b, hexA, hexB, min });
  });
});

describe('contrast: WCAG 2.x ratios', () => {
  // 1. Every pair in both light and dark themes passes its minimum.
  colorPairs.forEach(({ a, b, hexA, hexB, min }) => {
    test(`${a} vs ${b} (${a.startsWith('text') || b.startsWith('text') ? 'text' : 'non-text'}) passes at ${min}:1`, () => {
      const passed = passesContrast(hexA, hexB, min);
      expect(passed).toBe(true);
    });
  });

  // 2. #FFFFFF initials on each of the 7 avatar fills at 4.5:1 or more.
  avatarFills.forEach((fill, i) => {
    test(`avatar.fill${i + 1} (#${fill}) vs #FFFFFF passes 4.5:1`, () => {
      const passed = passesContrast('#FFFFFF', fill, textMin);
      expect(passed).toBe(true);
    });
  });
});