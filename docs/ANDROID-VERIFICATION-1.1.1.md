# Android verification — 2026-10-06

## Delivered build

- Package: `com.dailyops.dashboard`, version **1.1.1**, versionCode **3** (debug).
- Historical artifact: `artifacts/app-debug-1.1.1.apk`, 4,347,976 bytes.
- SHA-256: `90FD4C26700247DAD53D946D319BFB63EC2D98A9AA5E99C089D9891BD839EAD9`.
- APK signature verified with Android `apksigner` (v2 signature).
- Device: Samsung SM-T387W, Android 10, Android System WebView 153.0.8010.36.
- Physical landscape display: 1280 × 800; WebView viewport: 961 × 601 CSS pixels at density 1.33125.
- Toolchain: Node 24.19, Capacitor core/Android/CLI 8.5.2, App plugin 8.1.2, Java 21, Gradle 8.14.3, Android SDK 36.

## Version 1.1.1 checks

| Check                           | Result and evidence                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build and TypeScript | Passed through `build-android.cmd`; bundled assets synchronized and Gradle debug build completed.                                                                                       |
| Domain and storage tests        | 24 passed. Includes native migration, Java null/JavaScript undefined handling, corrupt legacy preservation, recovery exports, and failed saves.                                         |
| Browser regression tests        | 12 passed, covering the MVP, offline loading, themes, backups, recovery, and the large clock. Focused backup/recovery checks rerun after the final export safeguard.                    |
| Large clock                     | Actual tablet: tapping the header opens the live themed clock; seconds advance; Android Back and the visible return button return to the dashboard.                                     |
| Midnight and sizing             | Browser clock simulation crosses midnight and updates weekday/date. Clock fits 961 × 601 tablet and 390 × 844 phone viewports without scrolling.                                        |
| Dark Red preset                 | Muted red clock/accent, burgundy buttons, near-black backgrounds. Applies immediately and survives immediate force-stop/cold restart on the tablet. Original theme remains the default. |
| Native persistence              | Uses private SharedPreferences with a confirmed disk commit. Full saved JSON and selected theme are preserved across the update; test data and colors are restored afterward.           |
| Offline operation               | Bundled `https://localhost` origin, no native service worker. Offline reload, task creation/completion, and clock navigation passed; requests stayed within bundled local assets.       |
| Native display                  | `KEEP_SCREEN_ON`, `IMMERSIVE_STICKY`, `HIDE_NAVIGATION`, and `FULLSCREEN` flags verified. The large clock retains the awake flag.                                                       |
| Native navigation               | Home settings opens/returns without selecting a default. Android Back closes the detail view.                                                                                           |
| Backup export                   | Native document picker opens/cancels. A real JSON export to Downloads matches app storage; the uniquely named test file is removed.                                                     |
| Test cleanup                    | Pre-test saved JSON and theme restored exactly; temporary ADB forward removed.                                                                                                          |

During testing, an immediate force-stop reproduced loss of a just-selected theme in WebView localStorage. Version 1.1.1 therefore uses confirmed native disk writes. Migration handles the tablet's empty Java return appearing as JavaScript `undefined`; invalid legacy data stays untouched and remains exportable. One post-install `am start -W` exceeded the test harness's 30-second timeout; the app was inspected and reloaded, and subsequent cold-start and persistence checks passed. No data was cleared.

## Earlier hardware checks and user confirmation

The original 1.0 APK is retained as `artifacts/app-debug-1.0.apk` (SHA-256 `3F452513485D98F73A53662BDE6B5EDE9670F694FAFD02B286C58A04E63B9DAE`). On that build, charging stay-awake was disabled and screen timeout temporarily set to 15 seconds. The display remained Awake after 25 seconds with Daily Ops identified as `mHoldScreenWindow`. Original settings (stay-on 7, timeout 1,800,000 ms) were restored and rechecked. The native awake implementation is unchanged in 1.1.1; its window flags were rechecked.

On 2026-10-06, the user confirmed: **“USB disconnected and works as expected.”** This is user-confirmed physical operation, separate from automated offline network emulation.

Physical device reboot, optional default-Home startup after unlock, and all-day wall-charger endurance have not been verified. The Home role remains opt-in and was not changed by testing.

## Repeating the device checks

Use a connected, unlocked tablet with Daily Ops installed and leave it unused during testing. Set `ANDROID_SERIAL` from `adb devices`. These checks operate on the actual debug APK through its WebView debugging socket; no laptop web server is involved.

```powershell
$env:ANDROID_SERIAL = '<serial from adb devices>'
node scripts/android-smoke.mjs --clock-only --install-update
node scripts/android-smoke.mjs
node scripts/android-backup-check.mjs
.\scripts\android-awake-check.ps1 -DeviceSerial $env:ANDROID_SERIAL
```

`--clock-only` exercises the new clock and Dark Red preset; `--install-update` first installs the built APK and compares saved JSON. The normal smoke test covers native/offline/theme behavior and system pickers. `--native-only` limits it to native display/picker checks. Smoke tests restore the original JSON and theme in `finally` and remove temporary ADB forwarding. The backup check expects the English Save picker with Downloads selected. It verifies and removes only its uniquely named test export. The awake check temporarily changes and restores sleep settings. Do not disconnect USB while these scripts run.

Screenshots, raw reports, and pre-test backups are under ignored `artifacts/device/`. The original domain/browser tests and the device scripts replace generated arithmetic/example tests.
