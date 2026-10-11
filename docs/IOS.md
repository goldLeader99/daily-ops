# Daily Ops on iPhone and iPad

The iOS target uses Capacitor 8.5.2, an iOS/iPadOS 15 deployment target, and both iPhone and iPad device families. Native build, signing, installation, and physical-device results must be recorded separately; generating the project does not establish that it works on a device.

## iPhone verification on 2026-10-10

**Sync update: Daily Ops 1.3.0, build 8, is installed on the physical iPhone 14 Pro.** The final signed build, deep/strict signature, bundled web assets, callback scheme, and phone authorization passed verification. CoreDevice installation succeeded and an installed-app query confirmed the version/build. Application Support records were byte-identical before and after the in-place installation. Automatic launch was initially denied because the iPhone was locked; the user subsequently opened the app, signed in, and confirmed **SYNCED** after sharing its dashboard.

The update implements private account sync, durable offline edits, conflict review showing both values, a preserved pre-sync copy, iOS Keychain sessions, and optional home-iPad WAN sharing. All 44 unit tests and 20 browser tests passed; final conflict and backup checks passed separately. The cloud schema and exact native auth redirect are deployed. Live owner-isolation, stale-write, anonymous-denial, revision-protection, and traffic guards passed; disposable fixtures were rolled back, and Supabase's unfiltered Advisor Center reported no issues. A read-only live query confirmed one valid shared dashboard and one confirmed app account. See [CLOUD-SYNC.md](CLOUD-SYNC.md).

**The physical iPad mini 4 on iPadOS 15.8.8 also has Daily Ops 1.3.0/build 8 installed.** Its existing records were privately backed up before the in-place update. Installation without the debugger succeeded, a separate installed-app query confirmed the version/build, and saved records were byte-identical afterward. The signed profile includes this iPad. The user confirmed **SYNCED** after connecting the same app account, then confirmed that a task added on the iPhone appeared on the iPad and completion from the iPad appeared on the iPhone. Live modem readings remain unavailable; the user explicitly chose to leave that optional troubleshooting for now.

**Earlier safe-area update: Daily Ops 1.2.1, build 7, was installed on the physical iPhone 14 Pro running iOS 27.0.1.** CoreDevice installation succeeded, a separate query confirmed the installed version/build, and the updated app launched successfully. The phone's Application Support data file was privately backed up immediately before installation and was byte-identical after updating and launching. The app was updated in place.

The user's physical screenshots of build 6 showed the status bar overlapping both the dashboard and clock headers. Build 7 adds `viewport-fit=cover` and system safe-area padding on all four sides of the dashboard and dialogs; bottom notifications also clear the home indicator. Responsive spacing keeps these insets instead of replacing them. The clock uses a compact layout on short landscape screens so its date remains visible. This follows [WebKit's viewport and safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).

TypeScript, production/offline builds, and three browser checks passed: the existing clock behavior check, tablet/phone layout check, and a new safe-area geometry check covering phone portrait, phone landscape, iPad, and zero-inset layouts. Chromium uses supplied insets for this check; it does not emulate a physical cutout. A native iPhone 17 Pro simulator on iOS 26.3.1 separately built, installed, launched, and visually showed the dashboard below the status bar and Dynamic Island. The signed phone bundle passed deep/strict signature verification; its assets match the tested web build, the phone is included in its profile, and its identifier, team, and keychain groups are authorized. After the update, the user confirmed that both the dashboard and Clock headers look clear on the physical iPhone.

The following records the original iPhone installation:

**Daily Ops 1.2.0, build 6, was installed on the physical iPhone 14 Pro running iOS 27.0.1.** Xcode 26.3 paired with the phone; after the user enabled Developer Mode, CoreDevice reported Developer Mode enabled and DDI services available. The signed device build passed. Deep/strict signature verification passed with access to the Mac's signing keychain. The provisioning profile includes this phone, and the signed application identifier, team identifier, debug entitlement, and keychain groups are authorized by the profile. The profile also used for build 7 expires **2026-10-18 at 00:02:33 UTC (2026-10-17 at 20:02:33 EDT)**. Signing credentials and device identifiers remain outside this report.

CoreDevice installation returned success, and a separate installed-app query confirmed version 1.2.0, build 6. The arm64 app includes both device families, bundled dashboard assets, a minimum OS of 15.0, and no development-server URL. TypeScript, all 34 unit tests, the production build, and the existing tablet/phone browser layout check passed before installation. The browser check is separate from physical iPhone validation.

The first launch request was denied with iOS's signature/entitlements/developer-trust error. Signature and entitlement checks passed independently. After completing developer trust on the iPhone, the user confirmed that the Daily Ops dashboard opens. Physical first launch is confirmed by the user; backup/restore through the app, offline launch, and WAN readings on the physical phone have not yet been verified. Neither installation adds cloud sync: the iPhone and iPad still save their own local records.

## Verification on 2026-10-08

**Current update: Daily Ops 1.2.0, build 6, is installed on the physical iPad mini 4.** TypeScript, production build, 34 unit tests, 6 Python gateway-probe tests, 18 Chromium browser tests, signed native build, and deep/strict code-signature verification pass. Installation completed at 100% with exit code 0. A separate installed-app check passed, and the Application Support data file was byte-identical before and after the update. A private temporary copy is retained outside the repository. On 2026-10-10, the user reported the setup complete. This records user confirmation of the installed setup; individual Ethernet, charging, offline, and recovery checks were not reported separately.

The new NETWORK row opens WAN download/upload rates and recent traffic history. The app reads the XB10 directly using its advertised service description and cookie-free, read-only native HTTP requests. The Mac does not have to serve the installed dashboard or collect its readings. The source was verified on the Mac with actual IPv4/IPv6 transfers; browser native-bridge fixtures verify the rate/history/error interface separately. The gateway can change its service port; discovery and recovery instructions are in [IPAD-NETWORK-DASHBOARD.md](IPAD-NETWORK-DASHBOARD.md).

The following paragraphs record the earlier port baseline:

On the Intel Mac with macOS 15.7.7 and Xcode 26.3: TypeScript, production build, 24 domain/persistence tests, 12 Chromium browser tests, native Swift type-check, unsigned device build, and signed device build passed. The app is created programmatically by SceneDelegate and uses the system launch-screen configuration.

**Daily Ops 1.1.2, build 5, was installed on the physical iPad mini 4 running iPadOS 15.8.8.** The arm64 bundle has a minimum OS of 15.0, passed deep/strict code-signature verification, and contains a provisioning profile that includes the connected iPad. Installation through `ios-deploy` completed at 100% with exit code 0; a separate installed-app check returned true. The bundled dashboard assets are present and no development-server URL is configured.

Selecting the Personal Team in Xcode's App target → Signing & Capabilities generated the required device provisioning profile. Before that selection, command-line signing reported no registered devices and no matching profile. The current Personal Team profile expires **2026-10-15 at 21:01:44 UTC**; the app will need a fresh signed build and installation after expiry. Signing credentials, profile contents, and device identifiers remain outside this report.

The first physical launch displayed “Unable to Verify App,” requesting an internet connection to verify the developer. After the verification guidance, the user confirmed that Daily Ops now works on the iPad. Physical launch is confirmed by the user; saved-data persistence, offline launch, backup, navigation, layout, and Ethernet checks remain pending. If verification is required again, connect the iPad itself to the internet and complete Trust/Verify App for the Daily Ops developer entry in Settings → General → VPN & Device Management. See [Apple's manual app trust and verification guidance](https://support.apple.com/en-ca/118254). Do not confuse this developer-certificate verification with trusting the Mac over USB.

Xcode's debugger preparation remains unresolved. Earlier locked-device pairing errors cleared after unlocking and renewing Trust; pairing validation passed. Restarting the Mac/iPad, changing the direct USB port, and renewing the Mac-side pairing did not complete developer-image preparation. Fresh queries sometimes confirmed no mounted image, while uploads and Apple-framework lookup/mount attempts timed out, including with the Mac kept awake. The libimobiledevice trace reached `ReceiveBytes` without `ReceiveBytesAck`; one Apple-framework attempt reached `MountingImage` without confirmed completion. These results do not establish image incompatibility. Selecting the team enabled signing and installation without a debugger; it did not prove the debugger issue was fixed.

iPadOS 15.8.8 does not have the Developer Mode switch introduced with iPadOS 16. See [Apple's Developer Mode announcement](https://developer.apple.com/news/?id=r1sz7dke). The missing switch is not an installation requirement on this iPad.

After selecting the full Xcode installation with `xcode-select`, the simulator build passed. Daily Ops was installed and launched in an iPad mini (A17 Pro) simulator on iOS 26.3.1, its dashboard rendered, and its native bridge created the version-1 Application Support data file. After terminating and relaunching the app, the dashboard rendered again and the saved file's SHA-256 was unchanged. This verifies the simulator separately from the pending physical iPadOS 15 runtime checks.

## Implementation

- `DashboardViewController.swift` installs a main-frame, local-origin storage bridge before the dashboard loads. It uses a fixed file in Application Support, UTF-8 JSON, atomic replacement, and file protection. The existing synchronous repository confirms the native write before acknowledging a change; the Android adapter and version-1 backup schema are retained.
- The bridge only accepts storage operations from the bundled `capacitor://localhost` main frame. Other JavaScript prompts and WebView UI methods continue through Capacitor's existing delegate.
- JSON backup export uses the native Files export picker. Import uses the WebView file picker and the existing validation and replacement confirmation.
- Quick actions open validated HTTP(S) URLs in the external browser. Android Home, settings, and Back/minimize controls are excluded on iOS. The fullscreen button toggles the status bar; the physical Home button remains available.
- The scene disables automatic screen sleep only while active, and restores normal sleep behavior when inactive or backgrounded.
- The web build targets Safari 15 and ES2020. Viewport-height fallbacks remain available. Physical Safari/WebView layout and performance still require testing on the iPad mini 4.
- `DashboardWanPlugin.swift` permits private-gateway GETs and only the WAN byte/link getters. It rejects redirects and uses an ephemeral session without cookies, stored credentials, or cache. Info.plist declares the Local Network purpose and local-network transport allowance. No multicast entitlement or modem credentials are included.

## Build and install

Use Node 24 and pnpm 10.28.2. Install Xcode 26.3 and its required iOS components on the Sequoia Mac. If Xcode is outside Applications, select its Developer directory using `DEVELOPER_DIR` for each build command.

```sh
pnpm build
pnpm exec cap sync ios
pnpm exec cap open ios
```

The committed project excludes a personal signing team. For local builds, create an ignored `ios/signing.local.xcconfig` containing `DEVELOPMENT_TEAM = YOUR_TEAM_ID`; both Debug and Release include it when present. The existing Mac's team is preserved in that local file. In Xcode, select the App target, enable automatic signing, choose the Apple Account's team if needed, and select the connected, unlocked iPad. Build and run. Keep signing credentials and device identifiers outside source control. If the bundle identifier is unavailable to the selected team, choose a unique identifier and keep the Capacitor and Xcode identifiers consistent.

For a Personal Team, check the provisioning expiry in the generated profile; the app may require periodic rebuilding and reinstallation. Never promise permanent installation from a successful development build.

## Physical checks before treating the port as complete

1. Launch from the installed app icon with the Mac server stopped and internet disconnected.
2. Add and edit a task, counter, theme, and mileage entry; force-close immediately after saving and verify records on relaunch.
3. Export to Files, change a record, restore the exported JSON after confirmation, and verify recovery. A corrupt backup must not replace data.
4. Check dashboard, drawers, and large clock in both orientations; verify scrolling, keyboard, focus, and touch controls.
5. Leave with Home and switch apps. Confirm ordinary sleep behavior outside Daily Ops, then verify the dashboard stays awake while active.
6. Open an external shortcut and return. Confirm the installed dashboard remains offline ready.
7. Verify Ethernet and charging simultaneously. Allow Local Network access, open NETWORK, and confirm real LIVE rates, foreground/background behavior, and a clear stale/unavailable state if the gateway source disappears. The verified source and service-address limitation are documented in [IPAD-NETWORK-DASHBOARD.md](IPAD-NETWORK-DASHBOARD.md).
