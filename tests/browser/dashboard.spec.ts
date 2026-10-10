import { test, expect } from '@playwright/test';
const closeDrawer = async (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Back to dashboard', exact: true }).first().click();

test('tasks and groceries support CRUD and persistence through reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open TODAY', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await drawer.getByLabel('New task').fill('Browser test task');
  await drawer.getByRole('button', { name: 'ADD', exact: true }).click();
  await drawer.getByRole('checkbox', { name: 'Browser test task', exact: true }).check();
  await page.reload();
  await page.getByRole('button', { name: 'Open TODAY', exact: true }).click();
  await expect(
    drawer.getByRole('checkbox', { name: 'Browser test task', exact: true }),
  ).toBeChecked();
  await drawer.getByRole('button', { name: 'Edit Browser test task', exact: true }).click();
  await drawer.getByRole('textbox', { name: 'Edit task', exact: true }).fill('Renamed task');
  await drawer.getByRole('button', { name: 'SAVE', exact: true }).click();
  await drawer.getByRole('button', { name: 'Delete Renamed task', exact: true }).click();
  await expect(drawer.getByText('Renamed task', { exact: true })).toHaveCount(0);
  await closeDrawer(page);
  await page.getByRole('button', { name: 'Open GROCERIES', exact: true }).click();
  await drawer.getByLabel('New item').fill('Apples');
  await drawer.getByRole('button', { name: 'ADD', exact: true }).click();
  await drawer.getByRole('checkbox', { name: 'Apples', exact: true }).check();
  await drawer.getByRole('button', { name: 'Edit Apples', exact: true }).click();
  await drawer.getByRole('textbox', { name: 'Edit item', exact: true }).fill('Green apples');
  await drawer.getByRole('button', { name: 'SAVE', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open GROCERIES', exact: true }).click();
  await expect(drawer.getByRole('checkbox', { name: 'Green apples', exact: true })).toBeChecked();
  await drawer.getByRole('button', { name: 'Delete Green apples', exact: true }).click();
  await expect(drawer.getByText('Green apples', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('workout day selection and exercise completion persist independently', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open WORKOUT', exact: true }).click();
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  await page.getByRole('checkbox', { name: /Lat pulldown/ }).check();
  await page.getByRole('button', { name: 'DAY 1', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Barbell bench press/ })).not.toBeChecked();
  await page.getByRole('button', { name: 'DAY 2', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Lat pulldown/ })).toBeChecked();
  await page.reload();
  await page.getByRole('button', { name: 'Open WORKOUT', exact: true }).click();
  await expect(page.getByRole('button', { name: 'DAY 2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('checkbox', { name: /Lat pulldown/ })).toBeChecked();
});

test('mileage calculates 93 km, validates reversed readings and isolates vehicles', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open FLEX', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await drawer.getByLabel('STARTING ODOMETER', { exact: true }).fill('163088');
  await drawer.getByLabel('ENDING ODOMETER', { exact: true }).fill('163181');
  await drawer.getByLabel('SHIFT', { exact: true }).fill('Morning route');
  await drawer.getByLabel('ROUTE DIFFICULTY').selectOption('Difficult');
  await expect(drawer.locator('.distance-preview')).toContainText('93');
  await drawer.getByRole('button', { name: 'SAVE SHIFT', exact: true }).click();
  await expect(drawer.locator('.shift-record')).toHaveCount(1);
  await drawer.getByRole('combobox', { name: 'VEHICLE', exact: true }).selectOption('Subaru');
  await expect(drawer.locator('.shift-record')).toHaveCount(0);
  await drawer.getByLabel('STARTING ODOMETER', { exact: true }).fill('200');
  await drawer.getByLabel('ENDING ODOMETER', { exact: true }).fill('100');
  await drawer.getByLabel('SHIFT', { exact: true }).fill('Invalid route');
  await drawer.getByRole('button', { name: 'SAVE SHIFT', exact: true }).click();
  await expect(drawer.locator('.shift-record')).toHaveCount(0);
  await drawer.getByLabel('ENDING ODOMETER', { exact: true }).fill('250');
  await drawer.getByRole('button', { name: 'SAVE SHIFT', exact: true }).click();
  await expect(drawer.locator('.shift-record')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'Open FLEX', exact: true }).click();
  await expect(drawer.getByRole('combobox', { name: 'VEHICLE', exact: true })).toHaveValue(
    'Subaru',
  );
  await drawer.getByRole('combobox', { name: 'VEHICLE', exact: true }).selectOption('BMW');
  await expect(drawer.locator('.shift-record')).toContainText('93');
  await drawer.getByRole('button', { name: /Edit shift/ }).click();
  await drawer.getByLabel('ENDING ODOMETER', { exact: true }).fill('163188');
  await drawer.getByRole('button', { name: 'SAVE CHANGES', exact: true }).click();
  await expect(drawer.locator('.shift-record')).toContainText('100');
});

test('daily stats, projects and safe shortcuts survive refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open STATUS', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await drawer.getByLabel('WEIGHT (KG)', { exact: true }).fill('88.6');
  await drawer.getByLabel('PROTEIN CONSUMED (G)', { exact: true }).fill('82');
  await drawer.getByLabel('WATER (L)', { exact: true }).fill('2.1');
  await drawer.getByRole('checkbox', { name: 'Walking / activity complete' }).check();
  await drawer.getByRole('button', { name: 'SAVE DAILY STATS', exact: true }).click();
  await closeDrawer(page);
  await page.getByRole('button', { name: 'Open PROJECTS', exact: true }).click();
  await drawer.getByLabel('New project name').fill('Test project');
  await drawer.getByRole('button', { name: 'ADD', exact: true }).first().click();
  await drawer.getByLabel('New task', { exact: true }).fill('Write docs');
  await drawer.getByRole('button', { name: 'ADD', exact: true }).last().click();
  await drawer.getByRole('checkbox', { name: 'Write docs', exact: true }).check();
  await drawer.getByRole('combobox', { name: 'STATUS', exact: true }).selectOption('Paused');
  await drawer.getByRole('button', { name: 'SAVE PROJECT', exact: true }).click();
  await closeDrawer(page);
  await page.getByRole('button', { name: 'Configure quick actions' }).click();
  const cameras = drawer.locator('form').filter({ hasText: 'CAMERAS' });
  await cameras.getByLabel('URL', { exact: true }).fill('javascript:alert(1)');
  await cameras.getByRole('button', { name: 'SAVE SHORTCUT' }).click();
  await expect(cameras.getByRole('alert')).toBeVisible();
  await cameras.getByLabel('URL', { exact: true }).fill('https://example.com/cameras');
  await cameras.getByRole('button', { name: 'SAVE SHORTCUT' }).click();
  await page.reload();
  await expect(page.locator('.status-summary')).toContainText('88.6');
  await expect(page.getByRole('link', { name: 'CAMERAS', exact: true })).toHaveAttribute(
    'href',
    'https://example.com/cameras',
  );
  await page.getByRole('button', { name: 'Open PROJECTS', exact: true }).click();
  await drawer.getByRole('button', { name: 'Test project PAUSED' }).click();
  await expect(drawer.getByRole('checkbox', { name: 'Write docs', exact: true })).toBeChecked();
});

test('production app reloads offline with saved data', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText(/OFFLINE READY/)).toBeVisible();
  await page.getByRole('checkbox', { name: 'Workout', exact: true }).check();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'DAILY OPS', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Workout', exact: true })).toBeChecked();
  await context.setOffline(false);
});

test('tablet and phone layouts remain usable and drawer returns focus', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.system-footer')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/dashboard-landscape.png', fullPage: true });
  await page.getByRole('button', { name: 'Open TODAY', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open TODAY', exact: true })).toBeFocused();
  for (const size of [
    { width: 800, height: 1280 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Open FLEX', exact: true }).click();
    await expect(page.getByRole('button', { name: 'SAVE SHIFT', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => {
        const el = document.querySelector('dialog')!;
        return el.scrollWidth <= el.clientWidth;
      }),
    ).toBe(true);
    await closeDrawer(page);
  }
  await page.screenshot({ path: 'test-results/dashboard-phone.png', fullPage: true });
});

test('backup export and confirmed restore recover replaced data', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Workout', exact: true }).check();
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  const drawer = page.getByRole('dialog');
  const downloadEvent = page.waitForEvent('download');
  await drawer.getByRole('button', { name: 'EXPORT BACKUP', exact: true }).click();
  const downloaded = await downloadEvent;
  const backup = await readFile((await downloaded.path())!, 'utf8');
  expect(JSON.parse(backup).schemaVersion).toBe(1);
  await closeDrawer(page);
  await page.getByRole('checkbox', { name: 'Workout', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await drawer.getByLabel('Choose backup', { exact: true }).setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await expect(drawer.getByRole('button', { name: 'RESTORE BACKUP', exact: true })).toBeDisabled();
  await drawer
    .getByRole('checkbox', { name: 'Replace all current data with this backup.', exact: true })
    .check();
  await drawer.getByRole('button', { name: 'RESTORE BACKUP', exact: true }).click();
  await closeDrawer(page);
  await expect(page.getByRole('checkbox', { name: 'Workout', exact: true })).toBeChecked();
});

test('save failures retain form input and corrupt storage opens recovery', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: 'Open TODAY', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await drawer.getByLabel('New task').fill('Keep this draft');
  await drawer.getByRole('button', { name: 'ADD', exact: true }).click();
  await expect(drawer.getByLabel('New task')).toHaveValue('Keep this draft');
  await expect(drawer.getByRole('alert')).toContainText('Could not save');
  await expect(drawer.getByRole('checkbox', { name: 'Keep this draft' })).toHaveCount(0);
  await page.reload();
  await page.evaluate(() => localStorage.setItem('daily-ops:data:v1', '{broken'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Let’s protect your data.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('daily-ops:data:v1'))).toBe('{broken');
});

test('ID generation still works without the secure-context UUID API', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Open TODAY', exact: true }).click();
  await page.getByRole('dialog').getByLabel('New task').fill('LAN task');
  await page.getByRole('dialog').getByRole('button', { name: 'ADD', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'LAN task', exact: true })).toBeVisible();
});
