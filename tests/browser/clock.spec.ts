import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'America/Toronto' });

test('date and time open a live themed clock; midnight, return, focus, and tablet sizing work', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-06T23:59:00-04:00') });
  await page.goto('/');
  // Keep setup time from moving the exact midnight boundary on slower machines.
  await page.clock.pauseAt(new Date('2026-10-06T23:59:58-04:00'));
  await page.getByRole('button', { name: 'Customize theme', exact: true }).click();
  await page.getByLabel('Theme preset', { exact: true }).selectOption('Dark Red');
  await page.getByRole('button', { name: 'Back to dashboard', exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem('daily-ops:data:v1'));
  await page.locator('.clock-launcher .date-block').click();
  const clock = page.getByRole('dialog', { name: 'Clock', exact: true });
  await expect(clock).toBeVisible();
  await expect(clock.locator('time')).toHaveCSS('color', 'rgb(184, 104, 104)');
  await expect(clock.locator('.clock-face-time > span').first()).toHaveText('23:59');
  await page.clock.fastForward(2000);
  await expect(clock.locator('.clock-face-time > span').first()).toHaveText('00:00');
  await expect(clock.locator('.clock-face-seconds')).toHaveText('00');
  await expect(clock.locator('.clock-face-weekday')).toHaveText('WEDNESDAY');
  await expect(clock.locator('.clock-face-date')).toHaveText('OCTOBER 7, 2026');
  for (const viewport of [
    { width: 961, height: 601 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await clock.boundingBox();
    expect(bounds?.width).toBe(viewport.width);
    expect(bounds?.height).toBe(viewport.height);
    expect(
      await clock
        .locator('.drawer-body')
        .evaluate((el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 961, height: 601 });
  await page.screenshot({ path: 'test-results/clock-dark-red.png' });
  await clock.getByRole('button', { name: 'BACK TO DASHBOARD', exact: true }).click();
  await expect(clock).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open clock', exact: true })).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('daily-ops:data:v1'))).toBe(saved);
  await page.locator('.clock-launcher time').click();
  await expect(clock).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(clock).not.toBeVisible();
  await page.getByRole('button', { name: 'Open clock', exact: true }).press('Enter');
  await expect(clock).toBeVisible();
});
