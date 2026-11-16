import { expect, test } from '@playwright/test';

test('development queue controls persist offline and deliver with the synthetic sender', async ({ page }) => {
  test.skip(process.env.E2E_PRODUCTION === '1', 'Development diagnostics are excluded from production.');
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) problems.push(message.text()); });
  await page.route('https://**/*', () => { throw new Error('Synthetic diagnostics must not contact an external service.'); });
  await page.goto('/dev/queue');
  await expect(page.getByRole('heading', { name: 'Synthetic queue diagnostics' })).toBeVisible();
  await expect(page.getByText('No pending messages.')).toBeVisible();
  await page.getByRole('button', { name: 'Enqueue synthetic text' }).click();
  await expect(page.getByText('Pending: 1; Sent: 0; Cached: 0')).toBeVisible();
  await page.getByLabel('Connection').selectOption('online');
  await expect(page.getByText('Pending: 0; Sent: 1; Cached: 1')).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('production denies synthetic queue HTML and RSC', async ({ request }) => {
  test.skip(process.env.E2E_PRODUCTION !== '1', 'Requires the production artifact.');
  const variants: Record<string, string>[] = [{}, { RSC: '1' }];
  for (const headers of variants) {
    const response = await request.get('/dev/queue', { headers });
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain('Synthetic queue diagnostics');
    expect(await response.text()).not.toContain('synthetic-queue-only');
  }
});
