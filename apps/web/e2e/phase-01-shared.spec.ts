import { expect, test } from '@playwright/test';

const configured = process.env.E2E_SHARED_CONFIGURED === '1';

test('development shared consumer executes the current browser contracts', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.name));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) problems.push(message.type());
  });
  await page.goto('/dev');
  await expect(page.getByRole('heading', { name: 'Shared integration diagnostics' })).toBeVisible();
  await page.getByRole('button', { name: 'Check shared integration' }).click();
  await expect(page.getByRole('status')).toContainText(configured ? 'Shared integration ready' : 'Integration unavailable');
  await expect(page.getByRole('status')).toContainText('Message limit: 4096');
  await expect(page.getByRole('status')).toContainText('Synthetic ID:');
  const recovery = page.getByRole('region', { name: 'Connection recovery' });
  if (configured) {
    await expect(recovery).toHaveCount(0);
  } else {
    await expect(recovery.getByRole('alert')).toContainText('connection settings');
    await recovery.getByRole('button', { name: 'Try again' }).click();
    await expect(recovery.getByRole('alert')).toBeVisible();
  }
  expect(problems).toEqual([]);
});

test('denied browser storage can be restored and retried', async ({ page }) => {
  test.skip(!configured, 'Requires explicitly synthetic public configuration.');
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.name));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) problems.push(message.type());
  });
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Synthetic denial', 'SecurityError'); },
    });
    window.addEventListener('dg-test-restore-storage', () => {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
    }, { once: true });
  });
  await page.goto('/dev');
  await page.getByRole('button', { name: 'Check shared integration' }).click();
  const recovery = page.getByRole('region', { name: 'Connection recovery' });
  await expect(recovery.getByRole('alert')).toContainText('browser storage');
  await page.evaluate(() => window.dispatchEvent(new Event('dg-test-restore-storage')));
  await recovery.getByRole('button', { name: 'Try again' }).click();
  await expect(recovery).toHaveCount(0);
  await page.getByRole('button', { name: 'Check shared integration' }).click();
  await expect(page.getByRole('status')).toContainText('Shared integration ready');
  expect(problems).toEqual([]);
});
