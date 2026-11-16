import { expect, test } from '@playwright/test';

test('production root hydrates cleanly and denies the component gallery for HTML and RSC', async ({ page, request }) => {
  test.skip(process.env.E2E_PRODUCTION !== '1', 'Requires a source-matched local production server.');
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) problems.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.__NA)).toBe(true);
  const variants: Record<string, string>[] = [{}, { RSC: '1' }];
  for (const headers of variants) {
    const response = await request.get('/dev/components', { headers });
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain('Open form dialog');
  }
  expect(problems).toEqual([]);
});
