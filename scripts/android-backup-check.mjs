import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
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
adb('shell', 'am', 'start', '-W', '-n', appId + '/.MainActivity');
const pid = adb('shell', 'pidof', appId);
const port = adb('forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid);
const browser = await chromium.connectOverCDP('http://127.0.0.1:' + port);
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().startsWith('https://localhost/'));
const filename = 'daily-ops-smoke-' + Date.now() + '.json';
try {
  const content = await page.evaluate(
    () => window.DailyOpsStorage?.read() ?? localStorage.getItem('daily-ops:data:v1'),
  );
  await page.evaluate(
    ({ content, filename }) => {
      window.backupCheckResult = null;
      window.Capacitor.Plugins.DashboardDevice.exportBackup({ content, filename })
        .then((result) => {
          window.backupCheckResult = result;
        })
        .catch((error) => {
          window.backupCheckResult = { error: error.message };
        });
    },
    { content, filename },
  );
  let saveNode;
  for (let attempt = 0; attempt < 8 && !saveNode; attempt++) {
    adb('shell', 'uiautomator', 'dump', '/data/local/tmp/daily-ops-backup-ui.xml');
    const xml = adb('shell', 'cat', '/data/local/tmp/daily-ops-backup-ui.xml');
    writeFileSync('artifacts/device/backup-picker.xml', xml);
    saveNode = (xml.match(/<node\b[^>]*>/g) ?? []).find(
      (node) => /text="(?:SAVE|Save)"/.test(node) && /enabled="true"/.test(node),
    );
  }
  assert.ok(saveNode, 'Save button must be visible and enabled in the system document picker');
  const bounds = saveNode
    .match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    .slice(1)
    .map(Number);
  adb(
    'shell',
    'input',
    'tap',
    String(Math.floor((bounds[0] + bounds[2]) / 2)),
    String(Math.floor((bounds[1] + bounds[3]) / 2)),
  );
  await expect
    .poll(() => page.evaluate(() => window.backupCheckResult), { timeout: 15000 })
    .toEqual({ saved: true });
  const saved = adb('shell', 'cat', '/sdcard/Download/' + filename);
  assert.deepEqual(JSON.parse(saved), JSON.parse(content));
  console.log(
    'PASS: Native document export saved a JSON backup identical to the app data in Downloads.',
  );
  writeFileSync(
    'artifacts/device/backup-check.txt',
    'PASS: Exported JSON matches app storage. Temporary test export removed afterward.\n',
  );
} finally {
  // Only these uniquely named files were created by this test.
  adb(
    'shell',
    'rm',
    '-f',
    '/sdcard/Download/' + filename,
    '/data/local/tmp/daily-ops-backup-ui.xml',
  );
  adb('shell', 'am', 'start', '-W', '-n', appId + '/.MainActivity');
  writeFileSync(
    'artifacts/device/tablet-screen.png',
    execFileSync(adbPath, ['-s', process.env.ANDROID_SERIAL, 'exec-out', 'screencap', '-p']),
  );
  await browser.close();
  adb('forward', '--remove', 'tcp:' + port);
}
