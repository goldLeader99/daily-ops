import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function nativeGateway(page: Page, mode = 'normal') {
  await page.addInitScript(
    ({ mode }) => {
      const scope = window as unknown as {
        CapacitorCustomPlatform: { name: string };
        Capacitor: object;
        DailyOpsStorage: { read(): string | null; write(value: string): boolean };
        wanFixture: { failed: boolean; calls: { url: string; action?: string }[] };
      };
      scope.CapacitorCustomPlatform = { name: 'ios' };
      scope.wanFixture = { failed: mode === 'offline', calls: [] };
      scope.DailyOpsStorage = {
        read: () => localStorage.getItem('fixture-personal-data'),
        write: (value) => {
          localStorage.setItem('fixture-personal-data', value);
          return true;
        },
      };
      scope.Capacitor = {
        PluginHeaders: [{ name: 'DashboardWan', methods: [{ name: 'read', rtype: 'promise' }] }],
        nativePromise: async (
          _plugin: string,
          _method: string,
          options: { url: string; action?: string },
        ) => {
          scope.wanFixture.calls.push(options);
          if (scope.wanFixture.failed) throw new Error('Fixture gateway unavailable.');
          if (options.url.endsWith('IGDdevicedesc_brlan0.xml'))
            return {
              xml: `<root xmlns="urn:schemas-upnp-org:device-1-0"><device><deviceType>urn:schemas-upnp-org:device:InternetGatewayDevice:1</deviceType><serviceList><service><serviceType>urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1</serviceType><controlURL>${mode === 'foreign' ? 'http://10.0.0.2' : ''}/WAN/control</controlURL><SCPDURL>/WAN/scpd.xml</SCPDURL></service></serviceList></device></root>`,
            };
          if (options.url.endsWith('/WAN/scpd.xml'))
            return {
              xml: `<scpd xmlns="urn:schemas-upnp-org:service-1-0"><actionList><action><name>GetTotalBytesReceived</name></action>${mode === 'unsupported' ? '' : '<action><name>GetTotalBytesSent</name></action>'}<action><name>GetCommonLinkProperties</name></action></actionList></scpd>`,
            };
          const clock = BigInt(Math.floor(performance.now()));
          const baseline = 9007199254740993000n;
          const value =
            options.action === 'GetTotalBytesReceived'
              ? `<NewTotalBytesReceived>${baseline + clock * 1000n}</NewTotalBytesReceived>`
              : options.action === 'GetTotalBytesSent'
                ? `<NewTotalBytesSent>${baseline + clock * 125n}</NewTotalBytesSent>`
                : '<NewPhysicalLinkStatus>Up</NewPhysicalLinkStatus>';
          return {
            xml: `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:${options.action}Response xmlns:u="urn:schemas-upnp-org:service:WANCommonInterfaceConfig:1">${value}</u:${options.action}Response></s:Body></s:Envelope>`,
          };
        },
      };
    },
    { mode },
  );
}

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
