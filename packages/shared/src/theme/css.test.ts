import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateTokensCss } from './css';
import { color, motion } from './tokens';

describe('CSS token projection', () => {
  it('matches the checked-in deterministic output', () => {
    const css = generateTokensCss();
    expect(css).toBe(generateTokensCss());
    expect(readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')).toBe(css);
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    for (const scheme of ['light', 'dark'] as const) {
      expect(css).toContain(`--dg-color-bg-app: ${color[scheme].bg.app};`);
      expect(css).toContain(`--dg-color-brand-on-primary: ${color[scheme].text.inverse};`);
    }
    expect(css).toContain(`--dg-motion-delay-loading: ${motion.delay.loading}ms;`);
    expect(css).toContain(`--dg-motion-toast-duration: ${motion.toast.duration}ms;`);
  });
});
