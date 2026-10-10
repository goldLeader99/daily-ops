// Exercises the installed debug APK, not a laptop-hosted browser page.
// Requires ANDROID_SERIAL; it restores the app's pre-test JSON in a finally block.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const serial = process.env.ANDROID_SERIAL;
if (!serial) throw new Error('Set ANDROID_SERIAL to the intended test tablet.');
const adbPath =
  process.env.ADB_PATH || join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const adb = (...args) =>
  execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', timeout: 30000 }).trim();
const appId = 'com.dailyops.dashboard';
const key = 'daily-ops:data:v1';
const readDashboard = (key) => window.DailyOpsStorage?.read() ?? localStorage.getItem(key);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = { serial, model: adb('shell', 'getprop', 'ro.product.model'), checks: [] };
mkdirSync('artifacts/device', { recursive: true });
let browser, page, forwardPort, baseline;
async function connect() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const pid = adb('shell', 'pidof', appId);
    try {
      if (forwardPort) adb('forward', '--remove', 'tcp:' + forwardPort);
      forwardPort = adb('forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid);
      browser = await chromium.connectOverCDP('http://127.0.0.1:' + forwardPort, { timeout: 3000 });
      page = browser
        .contexts()[0]
        .pages()
        .find((p) => p.url().startsWith('https://localhost'));
      if (page) {
        await expect(page.locator('.app')).toBeVisible();
        return;
      }
    } catch {
      /* WebView creates its debug socket shortly after the Activity starts. */
    }
    await pause(500);
  }
  throw new Error('Could not connect to the installed Daily Ops debug WebView.');
}
async function restart() {
  await browser?.close();
  adb('shell', 'am', 'force-stop', appId);
  adb('shell', 'am', 'start', '-W', '-n', appId + '/.MainActivity');
  await connect();
}
function passed(check) {
  report.checks.push(check);
  console.log('PASS:', check);
}
async function nativeActivity(pattern) {
  await expect
    .poll(
      () =>
        adb('shell', 'dumpsys', 'activity', 'activities')
          .split('\n')
          .find((line) => line.includes('mResumedActivity')) ?? '',
      { timeout: 10000 },
    )
    .toMatch(pattern);
}
try {
  adb('shell', 'am', 'start', '-W', '-n', appId + '/.MainActivity');
  await connect();
  baseline = await page.evaluate(readDashboard, key);
  writeFileSync('artifacts/device/pre-test-data.json', baseline ?? 'null');
  if (process.argv.includes('--install-update')) {
    await browser.close();
    console.log(adb('install', '-r', 'artifacts/app-debug.apk'));
    adb('shell', 'am', 'start', '-W', '-n', appId + '/.MainActivity');
    await connect();
    assert.equal(await page.evaluate(readDashboard, key), baseline);
    passed('APK update preserves all existing saved data and the selected theme');
  }
  report.viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    ratio: devicePixelRatio,
  }));
  assert.equal(await page.evaluate(() => window.Capacitor.getPlatform()), 'android');
  assert.equal(await page.evaluate(() => location.origin), 'https://localhost');
  assert.equal(
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
    0,
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'artifacts/device/dashboard.png' });
  passed('Bundled Android origin, no service worker, no horizontal overflow');

  if (process.argv.includes('--clock-only')) {
    await page.getByRole('button', { name: 'Open clock', exact: true }).click();
    let clock = page.getByRole('dialog', { name: 'Clock', exact: true });
    await expect(clock).toBeVisible();
    assert.equal(
      await clock.locator('time').evaluate((el) => getComputedStyle(el).color),
      await page.locator('.clock-launcher time').evaluate((el) => getComputedStyle(el).color),
    );
    const initialSeconds = await clock.locator('.clock-face-seconds').textContent();
    await expect
      .poll(() => clock.locator('.clock-face-seconds').textContent(), { timeout: 5000 })
      .not.toBe(initialSeconds);
    await nativeActivity(/com.dailyops.dashboard/);
    const clockWindow = adb('shell', 'dumpsys', 'window', '-a', appId);
    const clockFlags = parseInt(clockWindow.match(/\bfl=([0-9a-f]+)/i)?.[1] ?? '0', 16);
    assert.equal(clockFlags & 0x80, 0x80, 'Clock retains FLAG_KEEP_SCREEN_ON');
    adb('shell', 'input', 'keyevent', '4');
    await expect(clock).not.toBeVisible();
    await nativeActivity(/com.dailyops.dashboard/);
    passed(
      'Live clock inherits the current colors, keeps awake, and Android Back returns to dashboard',
    );

    await page.getByRole('button', { name: 'Customize theme', exact: true }).click();
    await page.getByLabel('Theme preset', { exact: true }).selectOption('Dark Red');
    await expect(page.getByLabel('Theme preset', { exact: true })).toHaveValue('Dark Red');
    assert.equal(
      JSON.parse(await page.evaluate(readDashboard, key)).settings.theme.preset,
      'Dark Red',
    );
    await expect(page.locator('.clock-launcher time')).toHaveCSS('color', 'rgb(184, 104, 104)');
    passed('Dark Red has applied and is saved in Android storage before closing');
    await page.getByRole('button', { name: 'Back to dashboard', exact: true }).click();
    await restart();
    await expect(page.locator('.clock-launcher time')).toHaveCSS('color', 'rgb(184, 104, 104)');
    await browser.contexts()[0].setOffline(true);
    await page.reload();
    await page.locator('.clock-launcher .date-block').click();
    clock = page.getByRole('dialog', { name: 'Clock', exact: true });
    await expect(clock).toBeVisible();
    await expect(clock.locator('time')).toHaveCSS('color', 'rgb(184, 104, 104)');
    assert.equal(
      await clock
        .locator('.drawer-body')
        .evaluate((el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight),
      true,
    );
    await page.screenshot({ path: 'artifacts/device/clock-dark-red.png' });
    await clock.getByRole('button', { name: 'BACK TO DASHBOARD', exact: true }).click();
    await expect(clock).not.toBeVisible();
    await page.screenshot({ path: 'artifacts/device/dashboard-dark-red.png' });
    await browser.contexts()[0].setOffline(false);
    passed('Dark Red survives restart; large clock and return work offline without scrolling');
  } else if (!process.argv.includes('--native-only')) {
    await page.getByRole('button', { name: 'Customize theme', exact: true }).click();
    await page.getByLabel('Theme preset', { exact: true }).selectOption('Midnight Blue');
    await page.getByLabel('Clock hex', { exact: true }).fill('#e1ab45');
    await page.getByRole('heading', { name: 'Customize theme', exact: true }).click();
    await expect(page.locator('time')).toHaveCSS('color', 'rgb(225, 171, 69)');
    adb('shell', 'input', 'keyevent', '4');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    passed('Theme editing updates immediately; Android Back closes the drawer');
    await restart();
    await expect(page.locator('time')).toHaveCSS('color', 'rgb(225, 171, 69)');
    passed('Custom colors survive force-stop and cold app restart');

    const requests = [];
    page.on('request', (request) => requests.push(request.url()));
    await browser.contexts()[0].setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'DAILY OPS' })).toBeVisible();
    await page.getByRole('button', { name: 'Open TODAY', exact: true }).click();
    await page.getByRole('textbox', { name: 'New task', exact: true }).fill('Android offline test');
    await page.getByRole('dialog').getByRole('button', { name: 'ADD', exact: true }).click();
    await page.getByLabel('Android offline test', { exact: true }).check();
    await page.reload();
    await page.getByRole('button', { name: 'Open TODAY', exact: true }).click();
    await expect(page.getByLabel('Android offline test', { exact: true })).toBeChecked();
    assert.equal(
      requests.some((url) => /^https?:/.test(url) && !url.startsWith('https://localhost/')),
      false,
    );
    passed('Offline WebView reload and task completion persist; only APK-local assets requested');
    report.requests = [...new Set(requests)];
    await browser.contexts()[0].setOffline(false);
    await page.getByRole('button', { name: 'Back to dashboard', exact: true }).click();
  }

  // Insets may settle after the WebView dialog closes; verify the stable native state.
  await expect
    .poll(() => {
      const state = adb('shell', 'dumpsys', 'window', '-a', appId);
      return parseInt(state.match(/mSystemUiVisibility=0x([0-9a-f]+)/i)?.[1] ?? '0', 16) & 0x1006;
    })
    .toBe(0);
  const windowState = adb('shell', 'dumpsys', 'window', '-a', appId);
  writeFileSync('artifacts/device/window-state.txt', windowState);
  const flags = parseInt(windowState.match(/\bfl=([0-9a-f]+)/i)?.[1] ?? '0', 16);
  const systemUi = parseInt(
    windowState.match(/mSystemUiVisibility=0x([0-9a-f]+)/i)?.[1] ?? '0',
    16,
  );
  assert.equal(flags & 0x80, 0x80, 'FLAG_KEEP_SCREEN_ON');
  assert.equal(systemUi & 0x1006, 0, 'System navigation is visible by default');
  assert.match(windowState, /mHoldScreenWindow=.*com.dailyops.dashboard/);
  passed('Android window keeps awake with system navigation visible by default');

  if (!process.argv.includes('--clock-only')) {
    await page.getByRole('button', { name: 'Open settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'CHOOSE HOME APP', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'ANDROID SETTINGS', exact: true }).click();
    await nativeActivity(/com.android.settings/);
    adb('shell', 'input', 'keyevent', '4');
    await nativeActivity(/com.dailyops.dashboard/);
    await expect(page.getByRole('dialog')).toBeVisible();
    passed('Android settings opens and returns; launcher replacement option is absent');
    await page.getByRole('button', { name: 'EXPORT BACKUP', exact: true }).click();
    await nativeActivity(/documentsui/);
    adb('shell', 'input', 'keyevent', '4');
    await nativeActivity(/com.dailyops.dashboard/);
    await expect(page.getByRole('dialog')).toBeVisible();
    passed('Native backup Save document picker opens and cancels safely');
  }
} finally {
  try {
    if (baseline !== undefined) {
      adb('shell', 'am', 'start', '-W', '-n', appId + '/.MainActivity');
      if (!page || page.isClosed()) await connect();
      await browser.contexts()[0].setOffline(false);
      await page.evaluate(
        ({ key, baseline }) => {
          if (window.DailyOpsStorage) {
            if (baseline === null || !window.DailyOpsStorage.write(baseline)) {
              throw new Error('Could not restore the pre-test dashboard data.');
            }
          } else if (baseline === null) localStorage.removeItem(key);
          else localStorage.setItem(key, baseline);
        },
        { key, baseline },
      );
      await page.reload();
      await expect(page.getByRole('heading', { name: 'DAILY OPS' })).toBeVisible();
      assert.equal(await page.evaluate(readDashboard, key), baseline);
      passed('Pre-test dashboard data and theme restored');
    }
  } finally {
    writeFileSync(
      'artifacts/device/' +
        (process.argv.includes('--clock-only')
          ? 'clock-report.json'
          : process.argv.includes('--native-only')
            ? 'native-report.json'
            : 'report.json'),
      JSON.stringify(report, null, 2),
    );
    await browser?.close();
    if (forwardPort) adb('forward', '--remove', 'tcp:' + forwardPort);
  }
}
