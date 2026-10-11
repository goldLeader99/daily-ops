import { test, expect } from '@playwright/test';

test('dashboard and dialogs keep controls inside changing device safe areas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );
  // Chromium has no physical cutout. Supply representative system insets to
  // exercise the layout separately from the native WebKit/device check.
  for (const layout of [
    { width: 393, height: 852, top: 59, right: 0, bottom: 34, left: 0 },
    { width: 852, height: 393, top: 0, right: 59, bottom: 21, left: 59 },
    { width: 1024, height: 768, top: 20, right: 0, bottom: 0, left: 0 },
    { width: 393, height: 852, top: 0, right: 0, bottom: 0, left: 0 },
    { width: 1280, height: 800, top: 0, right: 0, bottom: 0, left: 0 },
  ]) {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.evaluate((insets) => {
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        document.documentElement.style.setProperty(`--safe-${side}`, `${insets[side]}px`);
      }
    }, layout);
    await page.evaluate(() => scrollTo(0, 0));
    const header = (await page.locator('.topbar').boundingBox())!;
    expect(header.y).toBeGreaterThanOrEqual(layout.top + 12);
    expect(header.x).toBeGreaterThanOrEqual(layout.left + 12);
    expect(header.x + header.width).toBeLessThanOrEqual(layout.width - layout.right - 12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page.locator('.app').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom)),
    ).toBeGreaterThan(layout.bottom);

    for (const title of ['Clock', 'Today']) {
      await page
        .getByRole('button', {
          name: title === 'Clock' ? 'Open clock' : 'Open TODAY',
          exact: true,
        })
        .click();
      const dialog = page.getByRole('dialog', { name: title, exact: true });
      await expect(dialog).toBeVisible();
      for (const locator of [
        dialog.locator('.drawer-heading .eyebrow'),
        dialog.getByRole('button', { name: 'Back to dashboard', exact: true }),
        dialog.getByRole('button', { name: 'BACK TO DASHBOARD', exact: true }),
      ]) {
        const bounds = (await locator.boundingBox())!;
        expect(bounds.y).toBeGreaterThanOrEqual(layout.top);
        expect(bounds.x).toBeGreaterThanOrEqual(layout.left);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(layout.width - layout.right);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(layout.height - layout.bottom);
      }
      if (title === 'Clock') {
        expect(
          await dialog
            .locator('.drawer-body')
            .evaluate(
              (el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight,
            ),
        ).toBe(true);
        if (layout.top === 59) {
          await page.screenshot({ path: 'test-results/clock-safe-area-phone.png' });
        }
      }
      await dialog.getByRole('button', { name: 'Back to dashboard', exact: true }).click();
    }
    if (layout.top === 59) {
      await page.screenshot({ path: 'test-results/dashboard-safe-area-phone.png' });
    }
  }
});
