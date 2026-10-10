// Real-device regression for leaving Daily Ops. Does not alter dashboard data or defaults.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

if (!process.env.ANDROID_SERIAL) throw new Error('Set ANDROID_SERIAL to the intended tablet.');
const adbPath = join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const adb = (...args) =>
  execFileSync(adbPath, ['-s', process.env.ANDROID_SERIAL, ...args], {
    encoding: 'utf8',
    timeout: 30000,
  }).trim();
const appId = 'com.dailyops.dashboard';
const component = appId + '/.MainActivity';
const report = { checks: [] };
const passed = (check) => {
  report.checks.push(check);
  console.log('PASS:', check);
};
const active = () =>
  adb('shell', 'dumpsys', 'activity', 'activities')
    .split('\n')
    .find((line) => line.includes('mResumedActivity')) ?? '';
const windowState = () => adb('shell', 'dumpsys', 'window', '-a', appId);
const flags = () => parseInt(windowState().match(/\bfl=([0-9a-f]+)/i)?.[1] ?? '0', 16);
const systemUi = () =>
  parseInt(windowState().match(/mSystemUiVisibility=0x([0-9a-f]+)/i)?.[1] ?? '0', 16);
const rawData = () => window.DailyOpsStorage.read();
const nativeScreenshot = (name) =>
  writeFileSync(
    'artifacts/device/' + name,
    execFileSync(adbPath, ['-s', process.env.ANDROID_SERIAL, 'exec-out', 'screencap', '-p']),
  );
mkdirSync('artifacts/device', { recursive: true });

const home = adb(
  'shell',
  'cmd',
  'package',
  'resolve-activity',
  '--brief',
  '-a',
  'android.intent.action.MAIN',
  '-c',
  'android.intent.category.HOME',
)
  .split('\n')
  .at(-1)
  .trim();
assert.ok(
  home.includes('/') && !home.includes(appId),
  'A normal launcher must be the default Home',
);
report.home = home;
const homePackage = home.split('/')[0];
assert.ok(
  !adb(
    'shell',
    'cmd',
    'package',
    'query-activities',
    '--brief',
    '-a',
    'android.intent.action.MAIN',
    '-c',
    'android.intent.category.HOME',
  ).includes(appId),
);
assert.match(adb('shell', 'dumpsys', 'activity', 'activities'), /mLockTaskModeState=NONE/);
passed('Daily Ops cannot replace Home and no screen pinning is active');

adb('shell', 'am', 'start', '-W', '-n', component);
const port = adb(
  'forward',
  'tcp:0',
  'localabstract:webview_devtools_remote_' + adb('shell', 'pidof', appId),
);
const browser = await chromium.connectOverCDP('http://127.0.0.1:' + port);
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().startsWith('https://localhost'));
let baseline;
async function reopen() {
  adb('shell', 'am', 'start', '-W', '-n', component);
  await expect.poll(active).toContain(appId);
  await expect.poll(() => flags() & 0x80).toBe(0x80);
  await expect.poll(() => systemUi() & 0x1006).toBe(0);
}
async function released() {
  await expect.poll(() => flags() & 0x80).toBe(0);
  assert.ok(!/mHoldScreenWindow=.*com.dailyops.dashboard/.test(windowState()));
}
async function tapSystemButton(id) {
  // Samsung's UIAutomator dump omits system bars. These centers were observed in
  // navigation-visible.png on this three-button landscape fixture, not guessed.
  // Fail on another display/model rather than tapping unrelated content.
  assert.equal(adb('shell', 'getprop', 'ro.product.model'), 'SM-T387W');
  const screen = execFileSync(adbPath, [
    '-s',
    process.env.ANDROID_SERIAL,
    'exec-out',
    'screencap',
    '-p',
  ]);
  assert.equal(screen.readUInt32BE(16), 1280);
  assert.equal(screen.readUInt32BE(20), 800);
  assert.equal(systemUi() & 0x1006, 0);
  const targets = { home: [642, 769], recent_apps: [362, 769] };
  const [x, y] = targets[id];
  adb('shell', 'input', 'tap', String(x), String(y));
}
try {
  await expect(page.locator('.app')).toBeVisible();
  baseline = await page.evaluate(rawData);
  writeFileSync('artifacts/device/navigation-pre-test-data.json', baseline);
  if (await page.getByRole('dialog').isVisible()) {
    await page.getByRole('button', { name: 'Back to dashboard', exact: true }).click();
  }
  await reopen();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  nativeScreenshot('navigation-visible.png');
  await tapSystemButton('home');
  await expect.poll(active).toContain(homePackage);
  await released();
  passed('Visible Android Home button reaches the launcher and releases the awake flag');

  await reopen();
  await tapSystemButton('recent_apps');
  await expect.poll(active).toContain(homePackage);
  await released();
  nativeScreenshot('recents.png');
  passed('Visible Recents button leaves the app and releases the awake flag');

  await reopen();
  await page.getByRole('button', { name: 'Toggle fullscreen', exact: true }).click();
  await expect.poll(() => systemUi() & 0x1006).toBe(0x1006);
  await page.getByRole('button', { name: 'Toggle fullscreen', exact: true }).click();
  await expect.poll(() => systemUi() & 0x1006).toBe(0);
  passed('Fullscreen is optional and the button toggles it off again');
  await page.getByRole('button', { name: 'Toggle fullscreen', exact: true }).click();
  await page.getByRole('button', { name: 'Go to Home screen', exact: true }).click();
  await expect.poll(active).toContain(homePackage);
  await released();
  await reopen();
  passed('In-app HOME exits fullscreen; reopening restores navigation and the awake flag');

  await page.getByRole('button', { name: 'Open clock', exact: true }).click();
  const clock = page.getByRole('dialog', { name: 'Clock', exact: true });
  await expect(clock).toBeVisible();
  const bounds = await clock.locator('.drawer-body').evaluate((el) => ({
    fits: el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight,
  }));
  assert.equal(bounds.fits, true);
  adb('shell', 'am', 'start', '-W', '-a', 'android.settings.SETTINGS');
  await expect.poll(active).toContain('com.android.settings');
  await released();
  await page.waitForTimeout(2000);
  assert.ok(active().includes('com.android.settings'), 'Dashboard must not reclaim the foreground');
  await reopen();
  await expect(clock).toBeVisible();
  const seconds = await clock.locator('.clock-face-seconds').textContent();
  await expect.poll(() => clock.locator('.clock-face-seconds').textContent()).not.toBe(seconds);
  adb('shell', 'input', 'keyevent', '4');
  await expect(clock).not.toBeVisible();
  adb('shell', 'input', 'keyevent', '4');
  await expect.poll(active).not.toContain(appId);
  await released();
  await reopen();
  assert.equal(await page.evaluate(rawData), baseline);
  passed(
    'Other apps remain usable; clock resumes live; Back exits normally; all saved data is unchanged',
  );
} finally {
  try {
    await reopen();
    if (await page.getByRole('dialog').isVisible()) {
      await page.getByRole('button', { name: 'Back to dashboard', exact: true }).click();
    }
    if (baseline !== undefined) assert.equal(await page.evaluate(rawData), baseline);
    nativeScreenshot('navigation-final.png');
    writeFileSync('artifacts/device/navigation-report.json', JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    adb('forward', '--remove', 'tcp:' + port);
  }
}
