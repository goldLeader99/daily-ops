# Daily Ops project handoff — 2026-10-08

Read this with `README.md`, `docs/MAC-SETUP.md`, and `docs/IPAD-NETWORK-DASHBOARD.md`. This records project context; it is not evidence that the Mac or iPad build has already been tested.

## User's objective

Continue the existing terminal-style personal dashboard on an iPad mini connected by Ethernet and power near a Rogers gateway. Preserve the current layout, editable colors including muted Dark Red, large clickable clock, personal trackers, and automatic cigarette/alcohol day counters. Add a practical local network view with real supported device/traffic/Wi-Fi measurements. The user wants an in-house interface rather than relying on the Rogers app.

Normal Home/app switching must remain available. Keep the screen awake only while the native app is active. Maintain local-first personal records and simple, understandable architecture; avoid implementing unrelated roadmap features.

## Confirmed equipment

- Mac: 15-inch MacBook Pro (2019), Intel Core i7, 16 GB RAM, macOS Sequoia 15.7.7. Xcode 26.3 is compatible according to Apple's requirements; its installation, signing setup, and available space have not been checked.
- iPad: iPad mini 4, iPadOS 15.8.8, Lightning. The user has an Ethernet adapter with charging support; operation with simultaneous charging has not been verified here.
- Router: Rogers XB10. Its local unauthenticated login page at `http://10.0.0.1/` returned HTTP 200 from the Windows laptop. There has been no authenticated inspection and no router configuration change.
- Existing Android device: Samsung Galaxy Tab A SM-T387W. Daily Ops 1.1.2 (versionCode 4) is installed and was physically tested.

Do not put passwords, tokens, serial numbers, private device inventories, or personal backup data in source control. No router credentials are included in this handoff.

## Working baseline

React 19, TypeScript, Vite 7, plain CSS, Capacitor 8. Node 24 and pnpm 10.28.2; use the lockfile. The web dashboard supports tasks, groceries, workout checks, mileage, daily stats, projects, URL actions, day counters, themes, clock view, backup restore/export, and a production offline shell.

Android 1.1.2 uses a Java storage bridge and foreground-only awake behavior. A former Home-launcher setup prevented normal use of other apps. The fix removed the HOME intent role, restored Samsung's launcher on the tablet, enabled navigation bars by default, and retained optional fullscreen. Capacitor `SystemBars.hidden` must remain `false` for the tested Android cold-start behavior. See `docs/ANDROID-VERIFICATION.md`.

Recorded verification: 24 domain/persistence tests and 12 browser tests passed on Windows, with TypeScript and production build checks passing. Physical Android navigation, awake behavior, backup, offline launch, and cold restart checks passed. These are historical results, not Mac or iPad verification.

## Important implementation constraints

1. There is **no iOS target yet**. The current `isNative` routes every native platform to Android-specific Java storage and device methods. Introduce explicit platform adapters before treating an iOS wrapper as functional. Relevant files: `src/native.ts`, `src/data/nativeStorage.ts`, `src/data/useDashboard.ts`, and `src/App.tsx`.
2. Implement and test iOS durable storage, backup import/export, safe external links, and foreground-only awake behavior. Do not use Android Home/settings methods on iPad. Preserve the existing schema and JSON backup compatibility.
3. Stay on Capacitor 8 for this target: its minimum OS is 15. Review all dependencies before upgrading to a major version with a higher minimum OS.
4. Review Safari 15 JavaScript/CSS compatibility and the smaller iPad mini layout; the current Vite build targets `es2022`. Test on the actual iPad, not only desktop Chromium.
5. Ethernet on the iPad does not measure radio strength. Display router-reported per-client RSSI only if available; do not fabricate a whole-home signal percentage. A switched Ethernet client also cannot measure every other device's traffic without a suitable source.
6. Prove available authenticated local router fields before building live charts. Local admin access and the Rogers app's features do not establish an API or accessible WAN/per-device counters. A collector cannot manufacture missing measurements.
7. Use a small local collector only if required by the router's interface/session handling. It may run on Windows, Mac, NAS, or another always-on host. The Mac used to build the iPad app need not be its runtime host.
8. Keep network samples separate from personal records and credentials. Show unavailable/stale data honestly, with source and timestamp. Router reboots or counter resets must not produce negative bandwidth.

## Next work

1. Inspect this Mac's tools; install dependencies and run the web app, tests, and production build using `docs/MAC-SETUP.md`.
2. Verify Xcode 26.3, the physical iPad connection, and Ethernet plus charging. Prepare and test the iOS platform adapters and build incrementally.
3. Have the user sign into the router locally and privately. Confirm gateway firmware, any separate Wi-Fi router/mesh, and supported read-only monitoring fields. Do not change Wi-Fi, bridge mode, or device access as part of monitoring discovery.
4. Add a network-source interface and only the capabilities established with real data. Decide whether an always-on collector is necessary from the evidence.
5. Test offline personal features, local-network permission/transport behavior, unreachable gateway, foreground/background transitions, and the live measurements on the iPad.

There was no Git remote configured in the Windows checkout. The transfer ZIP has no Git metadata or Codex session history. Source files are the current working copy; no GitHub publication has been performed. User records require a separate app backup export. No Mac connection is configured from the Windows conversation, so do not claim to have run commands on the Mac until doing so in its own session.
