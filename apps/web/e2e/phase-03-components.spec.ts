import { expect, test } from '@playwright/test';
import { avatarFills, color } from '../../../packages/shared/src/theme/tokens.ts';
import { resolve } from 'node:path';

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) problems.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) problems.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  Reflect.set(page, 'phaseThreeProblems', problems);
  await page.clock.install({ time: new Date('2026-11-15T00:00:00Z') });
  await page.goto('/dev/components');
  await expect(page.getByRole('heading', { name: 'Components', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.__NA)).toBe(true);
  // Test-scoped, bounded collection; no production diagnostic global.
  Reflect.set(page, 'phaseThreeProblems', problems);
});
test.afterEach(async ({ page }) => {
  expect(Reflect.get(page, 'phaseThreeProblems')).toEqual([]);
});

test('named controls follow DOM/visual order and icon targets are 44 px', async ({ page }) => {
  const main = page.getByRole('main');
  const controls = main.locator('button:visible, input:visible, textarea:visible, a:visible');
  for (const control of await controls.all()) await expect(control).toHaveAccessibleName(/\S/);
  const tabbables = main.locator('button:visible:enabled, input:visible:enabled, textarea:visible:enabled, a:visible');
  await tabbables.first().focus();
  for (const control of await tabbables.all()) {
    await expect(control).toBeFocused();
    await page.keyboard.press('Tab');
  }
  expect(await main.locator('[tabindex]').evaluateAll((nodes) => nodes.some((node) => Number(node.getAttribute('tabindex')) > 0))).toBe(false);
  for (const button of await main.locator('[data-icon-button]').all()) {
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('textbox', { name: 'Display name', exact: true }).focus();
  expect(await page.getByRole('textbox', { name: 'Display name', exact: true }).evaluate((node) => node.parentElement?.getBoundingClientRect().height)).toBe(44);
  expect(await page.getByLabel('Password', { exact: true }).evaluate((node) => node.parentElement?.getBoundingClientRect().height)).toBe(44);
  await expect(page.getByRole('textbox', { name: 'Display name', exact: true })).toHaveValue('Ana María Reyes');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('searchbox', { name: 'Search chats' }).fill('Ana');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.getByRole('searchbox')).toBeFocused();
});

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} uses account theme tokens for all surfaces and stable avatar fills`, async ({ page }) => {
    await page.getByRole('button', { name: theme === 'light' ? 'Light' : 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const cssColor = (hex: string) => `rgb(${[0, 2, 4].map((offset) => parseInt(hex.slice(1 + offset, 3 + offset), 16)).join(', ')})`;
    await expect(page.locator('body')).toHaveCSS('background-color', cssColor(color[theme].bg.app));
    await expect(page.getByRole('button', { name: 'primary action', exact: true })).toHaveCSS('background-color', cssColor(color[theme].brand.primary));
    await expect(page.getByRole('button', { name: 'danger action', exact: true })).toHaveCSS('background-color', cssColor(color[theme].danger.text));
    for (const [index, fill] of avatarFills.entries()) {
      const avatar = page.locator(`[data-fill="${index}"][data-variant="normal"]`).first();
      await expect(avatar).toHaveCSS('background-color', cssColor(fill));
      await expect(avatar).toHaveCSS('color', cssColor(color.light.badge.muted.text));
    }
    await page.screenshot({ path: resolve(`../../supabase/repomix/user-web-phase-03-20261115/gallery-${theme}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Open form dialog', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Example form', exact: true });
    await expect(dialog).toHaveCSS('background-color', cssColor(color[theme].bg.elevated));
    await page.getByRole('button', { name: 'Submit example' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Check your connection');
    await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Show action toast' }).click();
    await expect(page.getByRole('status')).toContainText('Check your connection');
    await page.getByRole('button', { name: 'Retry', exact: true }).last().click();
    await expect(page.getByRole('status')).toHaveText('Retry selected');
  });
}

test('300 ms delay, cancellation, retained width and reduced-motion feedback', async ({ page }) => {
  await page.clock.pauseAt(new Date('2026-11-15T01:00:00Z'));
  const button = page.getByRole('button', { name: 'primary loading', exact: true });
  const before = await button.boundingBox();
  await page.getByRole('button', { name: 'Toggle loading' }).click();
  await page.clock.runFor(299);
  expect(await page.locator('[aria-busy="true"] svg').count()).toBe(0);
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(2);
  const loading = page.getByRole('button', { name: 'Saving', exact: true }).first();
  expect((await loading.boundingBox())?.width).toBe(before?.width);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('status', { name: 'Loading' }).first()).toHaveCSS('animation-name', 'none');
  await expect(loading.locator('svg')).toHaveCSS('animation-duration', '1s');
  await page.getByRole('button', { name: 'Toggle loading' }).click();
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle loading' }).click();
  await page.clock.runFor(200);
  await page.getByRole('button', { name: 'Toggle loading' }).click();
  await page.clock.runFor(200);
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
});

test('nested Back/Forward/Escape preserves Next history, traps focus and restores each opener', async ({ page }) => {
  const url = page.url();
  const initialLength = await page.evaluate(() => history.length);
  await page.evaluate(() => history.replaceState({ ...history.state, phaseThreeMarker: { preserved: true } }, '', location.href));
  const routerState = await page.evaluate(() => ({ tree: history.state.__PRIVATE_NEXTJS_INTERNALS_TREE, na: history.state.__NA }));
  const opener = page.getByRole('button', { name: 'Open form dialog', exact: true });
  await opener.click();
  const form = page.getByRole('dialog', { name: 'Example form', exact: true });
  await expect(form).toBeVisible();
  const nested = form.getByRole('button', { name: 'Open nested confirmation' });
  await nested.click();
  const confirm = page.getByRole('dialog', { name: 'Example confirmation', exact: true });
  await expect(confirm).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(initialLength + 2);
  expect(await page.evaluate(() => history.state.phaseThreeMarker)).toEqual({ preserved: true });
  expect(await page.evaluate(() => ({ tree: history.state.__PRIVATE_NEXTJS_INTERNALS_TREE, na: history.state.__NA }))).toEqual(routerState);
  const last = confirm.getByRole('button', { name: 'Confirm example' });
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(confirm.getByRole('button', { name: 'Close Example confirmation' })).toBeFocused();
  await page.goBack();
  await expect(confirm).toHaveCount(0);
  await expect(nested).toBeFocused();
  await expect(page).toHaveURL(url);
  await page.goForward();
  await expect(confirm).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(initialLength + 2);
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(form).toBeVisible();
  await expect(nested).toBeFocused();
  await page.goBack();
  await expect(form).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.getByRole('main').evaluate((node) => node instanceof HTMLElement && node.inert)).toBe(false);
  expect(await page.locator('body').evaluate((node) => node.style.overflow)).toBe('');
});

test('portalled modal menu stays interactive, keyboard arrows and Escape close only menu', async ({ page }) => {
  await page.getByRole('button', { name: 'Open form dialog', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Example form', exact: true });
  const trigger = dialog.getByRole('button', { name: 'Dialog menu', exact: true });
  await trigger.click();
  const menu = dialog.getByRole('menu', { name: 'Dialog menu actions' });
  await expect(menu.getByRole('menuitem', { name: 'Copy', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: /Archive/ })).toBeFocused();
  await expect(menu.getByRole('menuitem', { name: /Archive/ })).toHaveAccessibleDescription('No connection');
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('route navigation with open nested overlays clears modal effects and normal history still works', async ({ page }) => {
  await page.getByRole('button', { name: 'Open form dialog', exact: true }).click();
  await page.getByRole('link', { name: 'Navigate from dialog' }).click();
  await expect(page).toHaveURL(/\/dev\/tokens$/);
  await expect(page.getByRole('heading', { name: 'Design tokens', exact: true })).toBeVisible();
  expect(await page.locator('body').evaluate((node) => node.style.overflow)).toBe('');
  expect(await page.locator('[inert]').evaluateAll((nodes) => nodes.filter((node) => node instanceof HTMLElement && node.inert).length)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/dev\/components$/);
  const dialog = page.getByRole('dialog', { name: 'Example form', exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('link', { name: 'View design tokens' }).click();
  await expect(page).toHaveURL(/\/dev\/tokens$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Components', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open form dialog', exact: true }).click();
  await page.getByRole('link', { name: 'Change example query' }).click();
  await expect(page).toHaveURL(/\?example=1$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.locator('body').evaluate((node) => node.style.overflow)).toBe('');
});

test('mobile sheet contains focus, keeps background inert, supports menus and nested dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const opener = page.getByRole('button', { name: 'Open bottom sheet' });
  await opener.click();
  const sheet = page.getByRole('dialog', { name: 'Example sheet', exact: true });
  await expect(sheet).toBeVisible();
  expect(await page.getByRole('main').evaluate((node) => node instanceof HTMLElement && node.inert)).toBe(true);
  await sheet.getByRole('button', { name: 'Sheet error example' }).focus();
  await page.keyboard.press('Tab');
  await expect(sheet.getByRole('button', { name: 'Close Example sheet' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(sheet.getByRole('button', { name: 'Sheet error example' })).toBeFocused();
  await sheet.getByRole('button', { name: 'Sheet menu', exact: true }).click();
  await expect(sheet.getByRole('menuitem', { name: 'Copy' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeVisible();
  const nested = sheet.getByRole('button', { name: 'Open sheet confirmation' });
  await nested.click();
  await expect(page.getByRole('dialog', { name: 'Example confirmation' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Example confirmation' })).toHaveCount(0);
  await expect(nested).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.getByRole('main').evaluate((node) => node instanceof HTMLElement && node.inert)).toBe(false);
  await page.goForward();
  await expect(sheet).toBeVisible();
  await page.setViewportSize({ width: 900, height: 844 });
  await expect(sheet).toHaveCount(0);
  expect(await page.getByRole('main').evaluate((node) => node instanceof HTMLElement && node.inert)).toBe(false);
});
