import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import type { DashboardContent } from '../../src/domain/model';
import { nativeGateway } from './fixtures/nativeGateway';

test('two signed-in devices share edits, preserve pre-sync records, and recover queued offline changes', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const userId = '11111111-1111-4111-8111-111111111111';
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'fixture@example.invalid',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    identities: [],
    created_at: '2026-10-10T10:00:00Z',
  };
  const jwt = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${jwt({ alg: 'HS256', typ: 'JWT' })}.${jwt({ sub: userId, role: 'authenticated', exp: 4102444800 })}.fixture`;
  let remote: { user_id: string; revision: number; document: DashboardContent } | null = null;
  let traffic: {
    source_id: string;
    download_mbps: number;
    upload_mbps: number;
    captured_at: string;
  } | null = null;
  let stale = false;
  let publishing = 0;
  async function fixture(context: BrowserContext) {
    await context.route('https://*.supabase.co/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/auth/v1/token') {
        return route.fulfill({
          json: {
            access_token: token,
            refresh_token: 'fixture-refresh-token',
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: 4102444800,
            user,
          },
        });
      }
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.pathname === '/rest/v1/daily_ops_dashboards') {
        const rows = remote
          ? [url.searchParams.get('select') === 'revision' ? { revision: remote.revision } : remote]
          : [];
        return route.fulfill({ json: rows });
      }
      if (url.pathname === '/rest/v1/rpc/daily_ops_commit') {
        const body = route.request().postDataJSON() as {
          expected_revision: number;
          dashboard: DashboardContent;
        };
        if (body.expected_revision !== (remote?.revision ?? 0))
          return route.fulfill({ json: null });
        remote = {
          user_id: userId,
          revision: body.expected_revision + 1,
          document: body.dashboard,
        };
        return route.fulfill({ json: remote.revision });
      }
      if (url.pathname === '/rest/v1/rpc/daily_ops_publish_traffic') {
        const body = route.request().postDataJSON();
        traffic = {
          source_id: body.source,
          download_mbps: body.download,
          upload_mbps: body.upload,
          captured_at: body.captured,
        };
        publishing++;
        return route.fulfill({ json: true });
      }
      if (url.pathname === '/rest/v1/rpc/daily_ops_read_traffic') {
        return route.fulfill({
          json: traffic
            ? [
                {
                  ...traffic,
                  age_ms: stale
                    ? 60_000
                    : Math.max(0, Date.now() - Date.parse(traffic.captured_at)),
                },
              ]
            : [],
        });
      }
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ json: {} });
      return route.fulfill({ status: 400, json: { message: 'Unexpected fixture request' } });
    });
  }
  async function signIn(page: Page) {
    await page.getByRole('button', { name: 'Open settings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Account & sync' })).toBeVisible();
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('fixture-password');
    await page.getByRole('button', { name: 'SIGN IN', exact: true }).click();
  }
  async function close(page: Page) {
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Back to dashboard', exact: true })
      .click();
  }
  const a = await browser.newContext(),
    b = await browser.newContext();
  await fixture(a);
  await fixture(b);
  const phone = await a.newPage(),
    tablet = await b.newPage();
  await nativeGateway(tablet);
  await phone.goto('/');
  await tablet.goto('/');
  await phone.getByRole('button', { name: 'Open TODAY', exact: true }).click();
  await phone.getByLabel('New task').fill('Shared from phone');
  await phone.getByRole('button', { name: 'ADD', exact: true }).click();
  await close(phone);
  const originalTablet = await tablet.evaluate(() => localStorage.getItem('fixture-personal-data'));
  await signIn(phone);
  await phone.getByRole('button', { name: 'SHARE THIS DASHBOARD', exact: true }).click();
  await expect(phone.locator('.account-sync [role="status"]')).toContainText('SYNCED');
  await close(phone);
  await signIn(tablet);
  await tablet.getByRole('button', { name: 'USE SHARED DASHBOARD', exact: true }).click();
  await expect(tablet.locator('.account-sync [role="status"]')).toContainText('SYNCED');
  expect(await tablet.evaluate(() => localStorage.getItem('fixture-before-sync'))).toBe(
    originalTablet,
  );
  await close(tablet);
  await tablet.getByRole('button', { name: 'Open TODAY', exact: true }).click();
  await expect(
    tablet.getByRole('checkbox', { name: 'Shared from phone', exact: true }),
  ).toBeVisible();
  await tablet.getByRole('checkbox', { name: 'Shared from phone', exact: true }).check();
  await phone.getByRole('button', { name: 'Open TODAY', exact: true }).click();
  await expect(phone.getByRole('checkbox', { name: 'Shared from phone', exact: true })).toBeChecked(
    { timeout: 12000 },
  );
  await close(phone);
  await a.setOffline(true);
  await phone.getByRole('button', { name: 'Open GROCERIES', exact: true }).click();
  await phone.getByLabel('New item').fill('Saved offline');
  await phone.getByRole('button', { name: 'ADD', exact: true }).click();
  await close(phone);
  await phone.reload();
  await expect(phone.getByRole('heading', { name: 'DAILY OPS', exact: true })).toBeVisible();
  await a.setOffline(false);
  await close(tablet);
  await tablet.getByRole('button', { name: 'Open GROCERIES', exact: true }).click();
  await expect(tablet.getByRole('checkbox', { name: 'Saved offline', exact: true })).toBeVisible({
    timeout: 15000,
  });
  await close(tablet);
  await a.setOffline(true);
  for (const [page, text] of [
    [phone, 'Phone edit'],
    [tablet, 'Tablet edit'],
  ] as const) {
    await page.getByRole('button', { name: 'Open TODAY', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Shared from phone', exact: true }).click();
    await page.getByRole('textbox', { name: 'Edit task', exact: true }).fill(text);
    await page.getByRole('button', { name: 'SAVE', exact: true }).click();
    await close(page);
  }
  await expect.poll(() => remote?.document.tasks.some((t) => t.text === 'Tablet edit')).toBe(true);
  await phone.getByRole('button', { name: 'Open settings', exact: true }).click();
  await a.setOffline(false);
  await expect(phone.locator('.account-sync [role="status"]')).toContainText('CONFLICT', {
    timeout: 12000,
  });
  await expect(phone.getByText(/This device: Phone edit · Shared: Tablet edit/)).toBeVisible();
  await phone.getByRole('button', { name: "KEEP THIS DEVICE'S EDITS", exact: true }).click();
  await expect(phone.locator('.account-sync [role="status"]')).toContainText('SYNCED');
  await expect.poll(() => remote?.document.tasks.some((t) => t.text === 'Phone edit')).toBe(true);
  await close(phone);
  await tablet.getByRole('button', { name: 'Open NETWORK', exact: true }).click();
  await tablet
    .getByRole('checkbox', { name: 'Share this device’s home readings', exact: true })
    .check();
  await expect.poll(() => publishing, { timeout: 12000 }).toBeGreaterThan(0);
  await phone.getByRole('button', { name: 'Open NETWORK', exact: true }).click();
  await expect(phone.getByRole('dialog').getByText('HOME LIVE', { exact: true })).toBeVisible({
    timeout: 12000,
  });
  expect(parseFloat(await phone.getByTestId('wan-download').innerText())).toBeGreaterThan(7.8);
  await tablet
    .getByRole('checkbox', { name: 'Share this device’s home readings', exact: true })
    .uncheck();
  const stoppedPublishing = publishing;
  stale = true;
  await expect(phone.getByRole('dialog').getByText('HOME STALE', { exact: true })).toBeVisible({
    timeout: 12000,
  });
  expect(publishing).toBe(stoppedPublishing);
  await expect(phone.getByText(/Last values retained; readings are not live/)).toBeVisible();
  await close(tablet);
  await tablet.getByRole('button', { name: 'Open settings', exact: true }).click();
  await tablet.getByRole('button', { name: 'SIGN OUT ON THIS DEVICE', exact: true }).click();
  await expect(tablet.getByRole('button', { name: 'SIGN IN', exact: true })).toBeVisible();
  await close(tablet);
  await tablet.getByRole('button', { name: 'Open GROCERIES', exact: true }).click();
  await expect(tablet.getByRole('checkbox', { name: 'Saved offline', exact: true })).toBeVisible();
  await a.close();
  await b.close();
});
