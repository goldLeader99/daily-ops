# iPad mini network dashboard

Status: verified gateway source and installed network update, 2026-10-08. **Daily Ops 1.2.0 (build 6)** is signed and installed on the iPad mini 4. Its existing saved records were byte-identical before and after the update. The NETWORK row and detail view read actual WAN traffic directly from the XB10; the user reported the installed setup complete on 2026-10-10. Individual physical validation steps were not reported separately. See [IOS.md](IOS.md).

## Intended behavior

Reuse Daily Ops' existing terminal layout, personal records, themes, counters, and large clock. Add a network panel that opens a detailed network view. The iPad connects to the home's LAN by Ethernet and remains powered near the gateway. Keep the screen awake only while the app is active; normal iPad Home/app-switching controls remain available.

The installed app bundles the dashboard so personal features do not require a running Mac or internet connection. Live network metrics still require access to their local source. If that source becomes unreachable, retain the last sample with its timestamp and clearly mark it stale.

## Confirmed equipment and remaining checks

- The supplied photos identify an **iPad mini 4 running iPadOS 15.8.8**, with a Lightning connector, and a **Rogers XB10 gateway**. Device serial numbers, Wi-Fi credentials, and MAC addresses are intentionally not recorded here.
- The user already has a Lightning Ethernet adapter with charging support. Verify simultaneous Ethernet connectivity and charging on the iPad before assuming the accessory works with this model.
- Apple documents a supported alternative: a Lightning to USB 3 Camera Adapter, a compatible USB-A Ethernet adapter, and a charger attached to the camera adapter's Lightning power port. Apple's camera-adapter compatibility list includes iPad mini 4. A USB-C hub is not the appropriate connector for this iPad.
- On 2026-10-08, an unauthenticated, read-only request from the Windows laptop to `http://10.0.0.1/` returned HTTP 200 and a Rogers login page. No credentials were submitted and no settings were changed. This establishes local page access, not access to live monitoring data.
- The existing Capacitor 8 framework supports iOS/iPadOS 15+, and the arm64 app targeting iPadOS 15 has been built, signed, installed, and launched on this iPad. Physical persistence, offline operation, backup, and the remaining device checks are recorded separately in [IOS.md](IOS.md).
- The **15-inch MacBook Pro (2019), Intel Core i7, 16 GB RAM, running macOS Sequoia 15.7.7** now uses Xcode 26.3. Mac baseline tests, native builds, simulator checks, and physical installation are recorded in [MAC-VERIFICATION.md](MAC-VERIFICATION.md) and [IOS.md](IOS.md).
- The user signed into the gateway locally on the Mac. The authenticated pages identify a **Sercomm SG417DBCT (XB10), hardware V1.3.B**, with firmware **Prod_25.1_PD / SMC-BL 7.0.0** and an active DOCSIS WAN. Connection Status, Rogers Network, Hardware LAN, and Diagnostic Tools expose no WAN byte totals. DOCSIS channel rates, codeword counts, Ethernet link speeds, and diagnostic ping packet counts are not current household throughput.
- With UPnP disabled, a bounded read-only SSDP discovery received no gateway service advertisement. The user approved a temporary enablement test, UPnP was restored to Disabled afterward, and the user then separately approved leaving it enabled for live monitoring. **UPnP is now enabled; Zero Config remains disabled.** UPnP also permits LAN devices to request automatic port mappings. Daily Ops does not create or change mappings.
- The advertised **WANCommonInterfaceConfig:1** service implements `GetTotalBytesReceived`, `GetTotalBytesSent`, and `GetCommonLinkProperties`. Both IPv4 and IPv6 validation downloads (2 MB each) increased received bytes; validation uploads (1 MB of dummy data each) increased sent bytes. Counter deltas included transport overhead and concurrent traffic. The active DOCSIS WAN and these controlled transfers establish the usable source; no link-capacity value or speed-test result is shown as current usage.

The WAN rate calculation in `src/network/traffic.ts` preserves cumulative-counter precision, uses the actual elapsed time, and discards comparisons across counter resets, WAN/source changes, or stale sampling gaps. `src/network/upnp.ts` verifies the advertised gateway and supported actions before reading counters. The iOS `DashboardWan` plugin uses a cookie-free native HTTP session restricted to private-gateway GETs and three WAN getters; redirects are refused. There is no admin login or password in the installed app.

`scripts/probe_gateway.py` is a bounded, read-only UPnP discovery probe. It follows only service URLs advertised by the selected gateway, rejects foreign endpoints and redirects, and permits only advertised WAN read actions. Run `python3 scripts/probe_gateway.py --gateway 10.0.0.1` to obtain the current `deviceDescriptionURL` and counter samples. It does not change modem settings. TypeScript, 34 unit tests, 6 Python probe tests, 18 browser tests, production build, and the signed iPad build pass. Browser network tests use explicit native-bridge fixtures and include both iPad orientations and pause/resume; those tests do not establish physical iPad network access.

**Service-address limitation:** this XB10 changed its advertised HTTP service port from 49153 to 49154 when UPnP was restarted. The installed build uses the newly advertised device-description address. If that address changes again, discover it on the Mac and update NETWORK → Connection settings → Gateway service URL. The app does not scan guessed ports or require an always-on Mac. A direct unicast SSDP test received no response; automatic iPad multicast discovery would require Apple's restricted multicast entitlement, which this Personal Team build does not request.

The user reported setup completion on 2026-10-10. Per-check results for physical Ethernet/charging/offline operation and recovery remain unrecorded. Do not put modem credentials in this document or source control.

Connect Ethernet to a LAN port on the active router or its switch, not a bridged modem's internet-facing connection.

## What can be done on Windows

The current Windows 11 laptop can develop and serve the browser dashboard, run tests, investigate the gateway, and host an optional local collector. A browser version opened in iPad Safari does not require a Mac to build. A locally hosted browser deployment requires its server to be available when loading the dashboard unless an appropriate offline installation/cache has been configured and verified; the existing HTTP development server is not an offline iPad installation.

A native iPad app requires macOS and Xcode to build, sign, and install. Our current Capacitor 8 toolchain requires Xcode 26+; Xcode 26.3 meets both the framework requirement and the supplied Mac's OS requirements. Apple provides older Xcode releases through its developer downloads with Apple Account sign-in. The Mac does not have to remain running after a bundled app is installed, unless it is also chosen to host a collector. Any collector host, including Windows, must remain awake and reachable for live data collected through it. Mac setup can proceed separately without blocking Windows-side investigation.

## What the network panel can show

| Metric                             | Source and limitation                                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Gateway reachable / internet check | Separate tests: a reachable gateway does not prove internet access. Label the probe and last check time.                    |
| Connected devices                  | Router's live association/client list when available. DHCP leases alone are not evidence that a device is currently online. |
| Current total upload/download      | Router WAN byte counters or a supported throughput API. An iPad's own Ethernet traffic is not total household usage.        |
| Per-device upload/download         | Only if the router exposes per-device accounting. Not inferred from a client list or signal bars.                           |
| Wi-Fi quality                      | Router/access-point reported signal strength for individual wireless clients, plus band/channel if available.               |
| Uptime / model / firmware          | Only fields actually available from the device.                                                                             |

Wi-Fi strength is measured at a receiver and varies by location and device. There is no single meaningful whole-home signal percentage. An iPad using Ethernet cannot measure Wi-Fi radio strength through that cable. Router-reported client RSSI, if exposed, can be displayed over Ethernet; room-by-room coverage measurements would require a Wi-Fi receiver in those locations. iPadOS does not provide a general-purpose Wi-Fi scanning API for ordinary apps.

Live bandwidth usage and a speed test are different. The panel should sample the gateway's WAN received/sent byte counters where available and calculate each direction as `delta bytes × 8 / elapsed seconds / 1,000,000` Mbps. Use the actual sample interval. Confirm the interface is the WAN so LAN-only traffic is not presented as total internet usage. Counter resets/reboots must discard negative deltas; missing values display as unavailable rather than zero. Each sample should include its source, observation time, and supported capabilities. A low or zero rate during idle periods represents low current usage, not a slow internet plan.

## Current architecture

The iPad reads the verified service directly over the home LAN:

```text
iPad Daily Ops → Ethernet or Wi-Fi LAN → XB10 WAN byte-counter getters
```

The native app polls while foregrounded, normally every two seconds. It takes a new baseline after pauses, failures, source changes, or counter resets. Delayed reads are rejected; stale values remain labeled with their last observation time. Charts hold only recent in-memory samples. Network connection settings stay separate from personal records and JSON backups.

The gateway's service has no browser CORS allowance. The web dashboard shows an explanatory unavailable state rather than fabricated readings; current direct monitoring is implemented for the iOS app. A browser collector could be added later if requested:

```text
iPad Daily Ops → Ethernet LAN → small local collector → router
```

The collector would run on an always-on Windows computer, Mac, NAS, or other computer, normalize supported fields, and serve a small local API. A future Docker package would be straightforward, but is not a prerequisite. The Mac needed to build the iPad app does not automatically need to be its runtime server.

Prefer a documented local API when available. Local admin-page access does not guarantee an API, WAN counters, or per-device statistics. A local collector cannot create measurements that the router does not expose. If the gateway lacks suitable data, first present the supported subset; evaluate another data source with the user before adding hardware or changing network configuration. The Rogers app's features alone do not establish third-party access.

Monitoring is read-only. Pausing devices, changing Wi-Fi, rebooting the gateway, and bridge-mode changes are separate future features. The current counter service requires no admin credentials. If a future source needs credentials, keep them in iOS Keychain or on a collector host, outside frontend assets, backups, and logs. The iOS target declares its Local Network purpose and local transport allowance.

## Changes needed in this repository

- Retain the existing Capacitor 8 iOS target and explicit platform adapters while targeting this iPad; reassess the minimum supported OS before any future framework-major upgrade.
- Keep the Safari 15 browser build target and verify touch layout/performance on the smaller iPad mini screen. Framework OS support alone does not establish application compatibility.
- Complete the physical checks for the implemented iOS storage, backup import/export, external links, and foreground-only screen-awake behavior. Standard iPad navigation remains available.
- Keep personal records separate from transient network samples and connection credentials. Continue supporting the existing JSON backups without resetting Android data.
- Add a small network-source interface with capability flags so unsupported router fields stay clearly unavailable. Add a collector only if the hardware investigation warrants it.
- Verify real Ethernet connectivity, foreground/background behavior, offline personal features, unavailable-router states, and the actual network metrics on the physical iPad.

## Further physical validation

The user reported the installed setup complete on 2026-10-10. For a documented physical validation, confirm NETWORK shows LIVE with changing readings after allowing Local Network access. Verify updates during traffic from another household device and after an idle interval; then test Ethernet with simultaneous charging, background/resume, and unavailable-router behavior. Check that a modem-service restart gives a clear connection error and can be recovered by updating the advertised service URL.

## References

- [Apple: USB-A Ethernet accessories and powered Lightning camera adapters](https://support.apple.com/en-us/111811)
- [Apple: Lightning to USB 3 Camera Adapter compatibility, including iPad mini 4](https://www.apple.com/ca/shop/product/mx5j3am/a/lightning-to-usb-3-camera-adapter)
- [Apple: iOS/iPadOS Wi-Fi API limitations](https://developer.apple.com/documentation/technotes/tn3111-ios-wifi-api-overview)
- [Rogers: gateway management and local browser sign-in](https://www.rogers.com/support/internet/manage-your-rogers-xfinity-gateway)
- [Rogers: how bridge mode changes the gateway's routing and Wi-Fi role](https://www.rogers.com/support/internet/turn-bridge-mode-on-or-off-for-your-rogers-xfinity-gateway)
- [UPnP: WANCommonInterfaceConfig byte-counter actions (optional)](https://upnp.org/specs/gw/UPnP-gw-WANCommonInterfaceConfig-v1-Service.pdf)
- [Apple: local-network privacy and multicast entitlement requirements](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- [Cloudflare: official download/upload validation endpoints](https://github.com/cloudflare/speedtest)
- [Capacitor iOS support](https://capacitorjs.com/docs/ios)
- [Capacitor build environment](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Apple: Xcode SDK and system requirements](https://developer.apple.com/xcode/system-requirements)
- [Apple: Xcode resources and downloads for older releases](https://developer.apple.com/xcode/resources/)
