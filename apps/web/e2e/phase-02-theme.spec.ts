import { expect, test } from '@playwright/test';
import { color, typeTokens, motion } from '../../../packages/shared/src/theme/tokens.ts';
import { iconNames } from '../../../packages/shared/src/theme/icons.ts';

for (const scenario of [
  { name: 'stored dark', stored: 'dark', system: 'light', expected: 'dark' },
  { name: 'system dark', stored: null, system: 'dark', expected: 'dark' },
  { name: 'explicit light overrides dark system', stored: 'light', system: 'dark', expected: 'light' },
  { name: 'invalid setting follows system', stored: 'invalid', system: 'dark', expected: 'dark' },
] as const) {
  test(`${scenario.name} applies before first paint with only self-hosted fonts`, async ({ page }) => {
    const problems: string[] = [];
    const externalFonts: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) problems.push(message.text()); });
    page.on('request', (request) => { if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(new URL(request.url()).hostname)) externalFonts.push(request.url()); });
    await page.emulateMedia({ colorScheme: scenario.system });
    await page.addInitScript(({ stored }) => {
      localStorage.removeItem('dg.theme');
      if (stored !== null) localStorage.setItem('dg.theme', stored);
      // Observe each pre-paint frame from the parser onward, not just hydrated CSS.
      const samples: string[] = [];
      Object.defineProperty(window, '__themeFrames', { value: samples });
      let count = 0;
      function sample() {
        if (document.body) samples.push(getComputedStyle(document.body).backgroundColor);
        count += 1;
        if (count < 120) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    }, { stored: scenario.stored });
    await page.goto('/dev/tokens');
    const hex = color[scenario.expected].bg.app.slice(1);
    const rgb = `rgb(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)})`;
    await expect(page.locator('body')).toHaveCSS('background-color', rgb);
    if (scenario.stored === 'light' || scenario.stored === 'dark') await expect(page.locator('html')).toHaveAttribute('data-theme', scenario.stored);
    else await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    await expect.poll(() => page.evaluate(() => Reflect.get(window, '__themeFrames').length)).toBeGreaterThan(0);
    const frames: string[] = await page.evaluate(() => Reflect.get(window, '__themeFrames'));
    expect(new Set(frames)).toEqual(new Set([rgb]));
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => [...document.fonts].filter((font) => font.status === 'loaded').length)).toBeGreaterThan(0);
    expect(externalFonts).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test('theme controls, system changes, cross-tab settings, tokens and reduced motion', async ({ page, context }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) problems.push(message.text()); });
  await page.goto('/dev/tokens');
  await expect(page.locator('[data-color]')).toHaveCount(Object.values(color.light).reduce((count, value) => count + (typeof value === 'string' ? 1 : Object.values(value).reduce((n, nested) => n + (typeof nested === 'string' ? 1 : Object.keys(nested).length), 0)), 0));
  await expect(page.locator('[data-type]')).toHaveCount(Object.keys(typeTokens).length);
  await expect(page.getByRole('region', { name: 'Semantic icons', exact: true }).getByRole('img')).toHaveCount(Object.keys(iconNames).length);
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Resolved theme: dark');
  const other = await context.newPage();
  other.on('pageerror', (error) => problems.push(error.message));
  await other.goto('/dev/tokens');
  await other.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Resolved theme: light');
  await page.getByRole('button', { name: 'System', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(page.getByRole('status')).toHaveText('Resolved theme: dark');
  expect(await page.locator('html').evaluate((element) => getComputedStyle(element).getPropertyValue('--dg-motion-duration-modal').trim())).toBe('0ms');
  expect(await page.locator('html').evaluate((element) => getComputedStyle(element).getPropertyValue('--dg-motion-duration-fast').trim())).toBe(`${motion.duration.fast}ms`);
  await expect(page.getByRole('img', { name: 'ui.loading', exact: true })).toHaveCSS('animation-name', 'none');
  await page.bringToFront();
  await page.getByRole('button', { name: 'System', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Light', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Light', exact: true })).toHaveCSS('outline-style', 'solid');
  await other.close();
  expect(problems).toEqual([]);
});

test('denied storage follows system at startup and reports unsaved selection', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Synthetic denial', 'SecurityError'); } }));
  await page.goto('/dev/tokens');
  await expect(page.getByRole('status')).toHaveText('Resolved theme: dark');
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Resolved theme: light');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('could not be saved');
  expect(problems).toEqual([]);
});
