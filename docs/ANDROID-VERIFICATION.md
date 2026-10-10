# Android verification — 2026-10-08

## Delivered build

- Package: `com.dailyops.dashboard`, version **1.1.2**, versionCode **4** (debug).
- Artifact: `artifacts/app-debug.apk`, 4,249,583 bytes.
- SHA-256: `2B828BCC6FEC9256EAF262ACF8968E6F700C0B69BF9629ACBE89865B17725F46`.
- APK v2 signature verified with Android `apksigner`.
- Device: Samsung SM-T387W, Android 10, physical landscape display 1280 × 800.
- Existing saved JSON and theme preserved. The original 1.1.1 APK is retained as `artifacts/app-debug-1.1.1.apk`; its earlier checks are in [the 1.1.1 report](ANDROID-VERIFICATION-1.1.1.md).

## Cause and correction

The connected tablet had Daily Ops selected as its default Home app. Home therefore resolved to Daily Ops rather than Samsung's launcher. Screen pinning was **not** active (`mLockTaskModeState=NONE`); there was no device-owner lock or global immersive policy.

One UI Home was restored as the default. Version 1.1.2 removes Daily Ops' Home intent filter and its Home-app setup option. It opens as a normal launcher app, with system bars visible and an explicit HOME button. Fullscreen toggles on/off and is reset when the app resumes. Both the Activity and Capacitor's `SystemBars.hidden` configuration now default to visible navigation; cold-start testing caught the latter overriding the Activity asynchronously.

The native awake flag is added on resume and cleared on pause. Home, Recents, and other Activities release the app's awake request. Returning to Daily Ops restores it. No background service, auto-relaunch, screen pinning, or boot-start behavior is introduced.

## Automated checks

- TypeScript, Vite production build, Capacitor sync, and Gradle debug build passed.
- 24 domain/storage tests passed.
- 12 browser tests passed, including clock rollover/layout, tasks, mileage, themes, backup/recovery, and offline use.
- Formatting checks passed.

## Device checks

- Installed version 1.1.2/code 4 confirmed; One UI Home resolves as the default launcher and Daily Ops is absent from Home candidates.
- Actual Home and Recents button taps leave Daily Ops; its awake flag clears and it stops being the screen-awake window.
- The in-app HOME button exits optional fullscreen. Returning restores visible navigation and the awake flag.
- Fullscreen toggles off correctly. Cold restart, offline reload, and returning from the clock retain visible navigation.
- Android Settings remains in the foreground until the user returns; the live clock resumes, and Back closes the clock then leaves the app.
- Original saved JSON and theme remain unchanged. The clock fits with system bars visible.
- With charging stay-awake temporarily disabled and screen timeout set to 15 seconds, Daily Ops remained Awake after 25 seconds. The original charging preference (7) and timeout (1,800,000 ms) were restored.

The actual Home and Recents controls are tested by touch at coordinates observed in the tablet screenshot. Samsung's UIAutomator dump does not expose these system-bar controls, so the fixture explicitly requires SM-T387W, a 1280 × 800 landscape screenshot, and the observed three-button navigation arrangement. Other devices or navigation modes need their own fixture.

Raw results live in ignored `artifacts/device/clock-report.json`, `navigation-report.json`, and `awake-check.txt`. Screenshots include `navigation-final.png` and `recents.png`.

The device's separate Developer-options **Stay awake while charging** preference was enabled (`stay_on_while_plugged_in=7`) before this fix. It was left unchanged. It can keep the screen awake outside Daily Ops when charging, but does not prevent switching apps. The timed awake check temporarily disables it and restores it afterward.

An ADB `am start -W` immediately following one update installation exceeded the harness's 30-second timeout. Installation itself succeeded and the preserved data was verified during cleanup; subsequent cold-start checks were run on the installed build. No app data was cleared.

## Repeat the checks

Use the connected, unlocked tablet and leave it unused during testing:

```powershell
$env:ANDROID_SERIAL = '<serial from adb devices>'
node scripts/android-smoke.mjs --clock-only --install-update
node scripts/android-navigation-check.mjs
.\scripts\android-awake-check.ps1 -DeviceSerial $env:ANDROID_SERIAL
```

The smoke test snapshots and restores saved data/theme in `finally`. The navigation test does not change dashboard data or default apps; it requires an ordinary launcher already selected. The awake check temporarily changes the charging preference and screen timeout, then restores both. Do not disconnect USB while tests run.

The user previously confirmed USB-disconnected operation on 2026-10-06. Long-duration wall-charger endurance and physical reboot are not part of this regression check. Boot auto-start is no longer a feature.
