import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'America/Toronto' });

test('both day counters persist, advance daily, and can be adjusted or reset', async ({
  page,
  context,
}) => {
  await page.clock.install({ time: new Date('2026-09-28T10:00:00-04:00') });
  await page.goto('/');
  const cigarettes = page.locator('.cigarettes-panel');
  const alcohol = page.locator('.alcohol-panel');
  await expect(cigarettes.locator('.counter-number')).toHaveText('—');
  await expect(alcohol.locator('.counter-number')).toHaveText('—');
  const drawer = page.getByRole('dialog');
  for (const [name, value] of [
    ['Days without cigarettes', '15'],
    ['Days without alcohol', '40'],
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await drawer.getByRole('spinbutton', { name: name.toUpperCase(), exact: true }).fill(value);
    await drawer.getByRole('button', { name: 'SAVE COUNTER', exact: true }).click();
    await drawer.getByRole('button', { name: 'Back to dashboard', exact: true }).click();
  }
  await page.reload();
  await expect(cigarettes.locator('.counter-number')).toHaveText('15');
  await expect(alcohol.locator('.counter-number')).toHaveText('40');
  await page.clock.fastForward(24 * 60 * 60 * 1000);
  await expect(cigarettes.locator('.counter-number')).toHaveText('16');
  await expect(alcohol.locator('.counter-number')).toHaveText('41');
  await page.getByRole('button', { name: 'Days without cigarettes', exact: true }).click();
  await drawer.getByRole('button', { name: 'Add one day', exact: true }).click();
  await drawer.getByRole('button', { name: 'Subtract one day', exact: true }).click();
  await expect(drawer.getByRole('spinbutton')).toHaveValue('16');
  await drawer.getByRole('button', { name: 'RESET TO ZERO', exact: true }).click();
  await drawer.getByRole('button', { name: 'SAVE COUNTER', exact: true }).click();
  await drawer.getByRole('button', { name: 'Back to dashboard', exact: true }).click();
  await expect(cigarettes.locator('.counter-number')).toHaveText('00');
  await expect(alcohol.locator('.counter-number')).toHaveText('41');
  await expect(page.getByText(/OFFLINE READY/)).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(cigarettes.locator('.counter-number')).toHaveText('00');
  await expect(alcohol.locator('.counter-number')).toHaveText('41');
});
