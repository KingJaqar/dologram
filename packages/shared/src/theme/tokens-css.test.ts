import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { generateWebTokensCss } from './css';
import { avatarFills, color, motion, space, typeTokens, z } from './tokens';

test('web CSS stays synchronized with the current shared source', () => {
  const css = generateWebTokensCss();
  expect(readFileSync(new URL('../../../../apps/web/src/theme/tokens.css', import.meta.url), 'utf8')).toBe(css);
  for (const c of Object.values(color)) expect(css).toContain(`--dg-color-bg-app: ${c.bg.app};`);
  expect(css).toContain(`--dg-space-5: ${space[5]}px;`);
  expect(css).toContain(`--dg-z-toast: ${z.toast};`);
  expect(css).toContain(`--dg-type-body-lg: 400 ${typeTokens.bodyLg.size / 16}rem/${typeTokens.bodyLg.lineHeight / 16}rem var(--dg-font-sans);`);
  expect(css).toContain('--dg-color-bubble-out-bg: var(--dg-color-bubble-outgoing);');
  expect(css).toContain('--dg-color-bubble-in-text: var(--dg-color-bubble-incoming-text);');
  avatarFills.forEach((fill, index) => expect(css).toContain(`--dg-avatar-fill-${index}: ${fill};`));
  expect(css).toContain(`--dg-avatar-text: ${color.light.badge.muted.text};`);
  expect(css).toContain(`--dg-motion-spinner-period: ${motion.duration.spinner}ms;`);
  const reduced = css.split('@media (prefers-reduced-motion: reduce)')[1];
  expect(reduced).toBeDefined();
  for (const key of Object.keys(motion.duration)) {
    const name = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    if (key === 'fast') expect(reduced).not.toContain(`--dg-motion-duration-${name}:`);
    else expect(reduced).toContain(`--dg-motion-duration-${name}: 0ms;`);
  }
});
