# Daily Ops on Samsung Galaxy Tab A

The Android app uses the same React dashboard as the browser. It contains the production Vite build inside the APK. It has no laptop server dependency, account, database server, analytics, or network API integrations.

## Build and install on this computer

```powershell
cd C:\Users\sri26\workspace\daily-ops
.\build-android.cmd
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r .\artifacts\app-debug.apk
```

The build script compiles TypeScript, builds Vite, synchronizes Capacitor assets, builds Android, and copies the debug APK to `artifacts/app-debug.apk`. The original Gradle output is `android/app/build/outputs/apk/debug/app-debug.apk`. The script uses the existing bundled Node if Node is not on PATH and the project-local JDK 21 when available. It installs no app automatically. Android Studio can open the `android/` directory; choose JDK 21 for **Settings → Build Tools → Gradle → Gradle JDK**.

Start the installed **Daily Ops** icon. Nothing needs to run on the laptop afterward. Use `adb install -r` for updates signed with the same debug key; uninstalling clears the app's saved data. Preserve `%USERPROFILE%\.android\debug.keystore` when moving build machines if you want compatible debug updates. A production release should use a separately managed signing key.

## Portable developer setup

Requirements: Node 22.12+, JDK 21, Android SDK Platform 36, Android Build Tools 35, Android Studio 2025.2.1+ or a compatible command-line Android SDK. Dependencies and Gradle/SDK downloads need internet at build time; the installed dashboard does not. SDK licenses must be accepted in Android Studio. [Capacitor 8 toolchain documentation](https://capacitorjs.com/docs/updating/8-0).

```sh
npm install --global pnpm@10.28.2
pnpm install --frozen-lockfile
pnpm build
pnpm exec cap sync android
pnpm exec cap open android
```

Equivalent npm workflow: `npm install`, `npm run build`, `npx cap sync android`, `npx cap open android`. The repository maintains `pnpm-lock.yaml`; avoid maintaining two different lockfiles. Do not run `cap add android` again: the customized native project is already checked in.

For a terminal Android build on Windows, set `JAVA_HOME` to JDK 21 and `ANDROID_HOME` to the SDK directory, then run `android\gradlew.bat -p android assembleDebug`. The included build launcher first rebuilds/syncs the web assets so it cannot accidentally package an old dashboard. The local Java ZIP used on this machine comes from [Microsoft OpenJDK](https://learn.microsoft.com/en-us/java/openjdk/download) and was SHA-256 verified; it lives under ignored `.tools/`, not in source control. Java 25 bundled with this newer Android Studio is too new for the pinned Gradle 8.14.3 toolchain.

## Display and navigation

- Landscape is requested with `sensorLandscape`; the tablet can rotate between the two landscape positions.
- Native `FLAG_KEEP_SCREEN_ON` is added on resume and explicitly cleared on pause. Daily Ops stays awake while active and releases its request when Home, Recents, or another Activity takes over. It does not prevent intentional power-button sleep. [Android screen-awake behavior](https://developer.android.com/develop/background-work/background-tasks/awake/screen-on).
- Android status/navigation bars are visible by default. The fullscreen button toggles immersive mode on/off; an edge swipe can reveal navigation in fullscreen. Reopening Daily Ops always restores visible navigation. It no longer re-hides navigation on every focus change. [Android immersive mode](https://developer.android.com/develop/ui/views/layout/immersive).
- The header **HOME** button opens the tablet's normal launcher, including from optional fullscreen.
- Android Back closes a detail drawer; from the main dashboard it minimizes the app. Home and Recents remain available.
- Tap the header's date or time for a large clock view in your current colors. It updates across midnight and on returning to the app. Use Back to dashboard or Android Back to return; the native screen-awake behavior continues while the clock is visible.
- The existing responsive layout is retained. On this 8-inch tablet, panels use the narrower layout and vertical scrolling; touch targets are not shrunk to cram every panel onto one screen. Dialog contents scroll independently with the return button visible.
- Native mode removes backdrop blur and text/indicator glow. The static CRT scanlines remain optional in Settings. There are no continuous GPU animations, videos, or remote fonts.

## Normal Home and app switching

Version 1.1.2 removes the Home-app role. Earlier builds could be selected as the default launcher, which makes pressing Home return to Daily Ops. Open Daily Ops from its icon when you want the always-on dashboard; use Home or Recents to leave. It does not auto-start after boot or reclaim the foreground.

If an earlier build was your default Home, use Android **Settings → Apps → Default apps → Home app → One UI Home**. After updating, Daily Ops is no longer a Home candidate. On the connected SM-T387W this default was restored to One UI Home during the 2026-10-08 fix. Saved dashboard records and colors are unaffected.

Android **Developer options → Stay awake** is a separate device-wide setting that can keep the whole tablet awake while charging. It does not block navigation and Daily Ops does not change it. Disable it yourself if you want normal screen timeout outside the app while charging; Daily Ops still stays awake when open. Keep the Samsung launcher installed.

## Theme and data

Tap **THEME**. Choose Dark (the original palette), AMOLED, Midnight Blue, Samsung Blue, Dark Red, Light, or Custom. Dark Red uses muted red on near-black backgrounds with burgundy buttons. Change any of eight colors with a picker or six-digit hex value. Colors save immediately; invalid partial hex input is not saved. **RESET TO DEFAULT** resets colors only. Filled action buttons use the Button color with automatically selected light/dark text; section highlights use Accent. Custom palettes can still have low contrast: reset or select a preset if needed. Updating the APK does not switch your selected theme.

Since version 1.1.1, data is stored as validated versioned JSON in the app's private SharedPreferences. A fixed-key Java bridge uses synchronous `commit()` so the UI acknowledges a save only after Android confirms the disk write. This addresses a reproduced WebView localStorage flush delay during an immediate force-stop. On first launch after upgrading, the previous WebView JSON is validated and copied unchanged; the legacy copy is retained, and subsequent saves use native storage. Failed migration or saving surfaces an error without replacing records. See [Android's commit contract](<https://developer.android.com/reference/android/content/SharedPreferences.Editor#commit()>).

The bridge is registered before the bundled page loads. It exposes only read/write of one dashboard value; external shortcuts open outside the WebView and the page disallows frames. Keep this trusted-local-content boundary if adding integrations later. The package ID must remain stable across upgrades, and the Capacitor origin must remain stable to read legacy WebView data. Uninstalling, clearing app data, or a factory reset removes records. Android cloud auto-backup is disabled; use explicit JSON export for backups.

Browser storage and APK storage are separate. Before moving your existing dashboard, export JSON from the browser's Settings. Transfer it to the tablet, open Daily Ops Settings → **CHOOSE BACKUP**, select it, and confirm replacement. Tasks, counters, workouts, mileage, stats, projects, shortcuts, CRT preference, and themes are included. Old backups without a theme receive the original default palette. Android export uses the system Save document picker without broad filesystem permissions.

Counter values are calculated from the saved start date and the tablet's current date. No background process or running laptop is required. They catch up on reopening; correct tablet date/time matters.

## Offline and networking audit

`src/`, `public/`, Vite config, and available environment files were checked. There are no backend `fetch`, Axios, WebSocket, or other API calls and no `.env` endpoint configuration. All local functionality and fonts are bundled. Spotify and Maps are external quick-action links. Cameras and Local AI have no URL until configured.

`capacitor.config.ts` has `webDir: 'dist'` and **no `server.url` or remote `allowNavigation`**. Capacitor's internal `https://localhost` URL belongs to its on-device asset handler; it does not contact your laptop, need port 5173, or require an ADB reverse tunnel. The browser service worker is deliberately skipped in native mode so installing an APK update uses its new assets.

Quick actions open an external browser/app. A user-configured `localhost`/`127.0.0.1` service link means the tablet itself; replace it with the server's reachable LAN address or HTTPS hostname when importing a laptop backup. Such services still need their server and network. No backend endpoint in this project's source needs rewriting. App URI schemes are not enabled in this MVP; the native link boundary can support a deliberate allowlist later.

## Verification

See [device verification report](ANDROID-VERIFICATION.md) for the actual build, automated checks, and hardware checks performed. The user confirmed USB-disconnected operation on 2026-10-06. Long-duration wall-charger operation has not been verified. Home startup is intentionally no longer a feature.
