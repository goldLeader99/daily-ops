import { test, expect } from '@playwright/test';

test('themes apply immediately, survive reload, and reset independently of data', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Workout', { exact: true }).check();
  await page.getByRole('button', { name: 'Customize theme', exact: true }).click();
  await page.getByLabel('Theme preset', { exact: true }).selectOption('Light');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(237, 240, 232)');
  await page.getByLabel('Clock hex', { exact: true }).fill('#a12345');
  await expect(page.locator('time')).toHaveCSS('color', 'rgb(161, 35, 69)');
  await expect(page.getByLabel('Theme preset', { exact: true })).toHaveValue('Custom');
  await page.reload();
  await expect(page.locator('time')).toHaveCSS('color', 'rgb(161, 35, 69)');
  await expect(page.getByLabel('Workout', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Customize theme', exact: true }).click();
  for (const name of ['AMOLED', 'Midnight Blue', 'Samsung Blue', 'Dark', 'Dark Red']) {
    await page.getByLabel('Theme preset', { exact: true }).selectOption(name);
    await expect(page.getByLabel('Theme preset', { exact: true })).toHaveValue(name);
  }
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(9, 7, 7)');
  await expect(page.locator('time')).toHaveCSS('color', 'rgb(184, 104, 104)');
  await page.reload();
  await expect(page.locator('time')).toHaveCSS('color', 'rgb(184, 104, 104)');
  await page.getByRole('button', { name: 'Customize theme', exact: true }).click();
  await expect(page.getByLabel('Theme preset', { exact: true })).toHaveValue('Dark Red');
  await page.getByRole('button', { name: 'RESET TO DEFAULT', exact: true }).click();
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(11, 16, 14)');
  await page.getByRole('button', { name: 'Back to dashboard', exact: true }).click();
  await expect(page.getByLabel('Workout', { exact: true })).toBeChecked();
});
