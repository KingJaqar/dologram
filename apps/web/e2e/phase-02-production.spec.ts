import { expect, test } from '@playwright/test';

test('production self-hosts fonts and denies the token gallery', async ({ page, request }) => {
  test.skip(process.env.E2E_PRODUCTION !== '1', 'Requires a source-matched production server.');
  const problems: string[] = [];
  const fontRequests: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) problems.push(message.text()); });
  page.on('request', (req) => {
    if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(new URL(req.url()).hostname)) problems.push('External font request');
    if (req.resourceType() === 'font') fontRequests.push(req.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(fontRequests.length).toBeGreaterThan(0);
  expect(fontRequests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  const variants: Record<string, string>[] = [{}, { RSC: '1' }];
  for (const headers of variants) {
    const response = await request.get('/dev/tokens', { headers });
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain('Resolved theme:');
  }
  expect(problems).toEqual([]);
});
