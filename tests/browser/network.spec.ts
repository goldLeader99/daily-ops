import { test, expect } from '@playwright/test';
import { nativeGateway } from './fixtures/nativeGateway';

test('native WAN readings preserve large counters, show history and retain stale values on failure', async ({
  page,
}) => {
  await nativeGateway(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open NETWORK', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText('LIVE', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('img', { name: 'Recent download traffic' })).toBeVisible();
  const download = parseFloat(await drawer.getByTestId('wan-download').innerText());
  const upload = parseFloat(await drawer.getByTestId('wan-upload').innerText());
  expect(download).toBeGreaterThan(7.8);
  expect(download).toBeLessThan(8.2);
  expect(upload).toBeGreaterThan(0.95);
  expect(upload).toBeLessThan(1.05);
  await page.screenshot({ path: 'test-results/network-native-fixture.png', fullPage: true });
  const before = await drawer.getByTestId('wan-download').innerText();
  await page.evaluate(() => {
    (window as unknown as { wanFixture: { failed: boolean } }).wanFixture.failed = true;
  });
  await expect(drawer.getByText('UNAVAILABLE', { exact: true })).toBeVisible();
  await expect(drawer.getByTestId('wan-download')).toHaveText(before, { useInnerText: true });
  await expect(drawer.getByText(/Last values retained/)).toBeVisible();
});

test('failed initial reads show unavailable values rather than invented zeros', async ({
  page,
}) => {
  await nativeGateway(page, 'offline');
  await page.goto('/');
  await page.getByRole('button', { name: 'Open NETWORK', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('UNAVAILABLE', { exact: true })).toBeVisible();
  await expect(page.getByTestId('wan-download')).toContainText('—');
  await expect(page.getByText('No traffic reading yet.')).toBeVisible();
});

test('iPad layouts fit and paused polling resumes with a fresh baseline', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await nativeGateway(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open NETWORK', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText('LIVE', { exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: 'PAUSE READINGS', exact: true }).click();
  await expect(drawer.getByText('PAUSED', { exact: true })).toBeVisible();
  const calls = await page.evaluate(
    () => (window as unknown as { wanFixture: { calls: object[] } }).wanFixture.calls.length,
  );
  // Wait beyond a normal sampling interval to prove the timer was stopped.
  await page.waitForTimeout(2200);
  expect(
    await page.evaluate(
      () => (window as unknown as { wanFixture: { calls: object[] } }).wanFixture.calls.length,
    ),
  ).toBe(calls);
  await expect(drawer.getByText(/Last values retained/)).toBeVisible();
  for (const size of [
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(
      drawer.getByRole('button', { name: 'RESUME READINGS', exact: true }),
    ).toBeInViewport();
  }
  await drawer.getByRole('button', { name: 'RESUME READINGS', exact: true }).click();
  await expect(drawer.getByText('SAMPLING', { exact: true })).toBeVisible();
  await expect(drawer.getByText('LIVE', { exact: true })).toBeVisible();
  expect(parseFloat(await drawer.getByTestId('wan-download').innerText())).toBeLessThan(8.2);
});

for (const mode of ['foreign', 'unsupported'])
  test(`rejects ${mode} WAN services before counter requests`, async ({ page }) => {
    await nativeGateway(page, mode);
    await page.goto('/');
    await page.getByRole('button', { name: 'Open NETWORK', exact: true }).click();
    await expect(page.getByRole('dialog').getByText('UNAVAILABLE', { exact: true })).toBeVisible();
    const calls = await page.evaluate(
      () =>
        (window as unknown as { wanFixture: { calls: { url: string; action?: string }[] } })
          .wanFixture.calls,
    );
    expect(calls.every((call) => new URL(call.url).hostname === '10.0.0.1')).toBe(true);
    expect(calls.some((call) => call.action)).toBe(false);
  });

test('browser explains the direct gateway limitation and network view closes normally', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open NETWORK', exact: true }).click();
  await expect(
    page.getByText(/installed Daily Ops iPad app for direct gateway readings/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to dashboard', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Open NETWORK', exact: true })).toBeFocused();
});
