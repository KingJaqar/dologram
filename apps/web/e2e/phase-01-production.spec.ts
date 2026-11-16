import { expect, test } from '@playwright/test';

test('production denies diagnostics, descendants and RSC access', async ({ page, request }) => {
  test.skip(process.env.E2E_PRODUCTION !== '1', 'Requires a source-matched production server.');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  for (const path of ['/dev', '/dev/queue', '/dev/nested/fault', '/dev?fault=1']) {
    const variants: Record<string, string>[] = [{}, { RSC: '1' }];
    for (const headers of variants) {
      const response = await request.get(path, { headers });
      expect(response.status()).toBe(404);
      expect(await response.text()).not.toContain('Shared integration diagnostics');
      expect(await response.text()).not.toContain('Check shared integration');
    }
  }
  expect(await page.evaluate(() => Object.keys(window).filter((key) => /^__dg/.test(key)))).toEqual([]);
});
