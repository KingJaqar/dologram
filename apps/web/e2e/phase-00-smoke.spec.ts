import { expect, test } from '@playwright/test';

test('root serves the DoloGram application without browser errors', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.name));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) problems.push(message.type());
  });
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('DoloGram');
  await expect(page.locator('meta[name="application-name"]')).toHaveAttribute('content', 'DoloGram');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('main').getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();
  expect(problems).toEqual([]);
});
