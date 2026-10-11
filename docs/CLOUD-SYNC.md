# Daily Ops cloud sync

The 1.3.0 implementation connects the same Daily Ops app account on iPhone and iPad to one private dashboard in Supabase. A Supabase dashboard login manages the project; it is separate from the app account created in Daily Ops. Deployment and physical-device acceptance are tracked below; source code alone does not establish a working cloud connection.

## First connection

1. On the iPhone, open Settings → Account & sync. Create an app account using your own email and password, confirm the email, then sign in. Enter credentials on the device only.
2. Choose **SHARE THIS DASHBOARD** on the iPhone. Its current records become the initial shared dashboard. Both devices must use this same app account.
3. On the updated iPad, sign in and choose **USE SHARED DASHBOARD**. The app saves a private pre-sync copy before adopting shared records. **EXPORT PRE-SYNC COPY** exports that original copy to Files.
4. Add a task on one device and check the other. Then edit from the other device. With both apps foreground and online, uploads start after about 300 ms and remote revisions are checked every five seconds.

Tasks, groceries, workouts, daily stats, counters, mileage, projects, shortcuts, and theme share. Gateway addresses, home-source preferences, app credentials, and local backup files remain device-specific. Signing out keeps saved records and pending edits on that device. Returning to the original account resumes syncing. The app refuses to connect records already linked to a different account.

Changes are durably saved locally before they are acknowledged. The last accepted cloud document and revision are saved atomically with current records. After an offline restart, a three-way merge combines independent changes; edits to the same field and deletion versus editing require a choice. The review shows each device's value. A choice applies only to the versions reviewed. The server rejects a write based on an old revision, and edits made during an upload remain pending afterward.

An imported backup replaces the current dashboard after confirmation. On a connected device, restored records also sync to the other devices. Export a separate backup before restoring. Exported dashboard JSON excludes account identity and sync metadata. The pre-sync copy is retained once per installation and is not overwritten by later connections.

## Home modem traffic from away

On the home iPad, open NETWORK and enable **Share this device’s home readings**. Keep this off on the traveling iPhone. The producer must stay connected to the home gateway with Daily Ops open; iOS background suspension stops sampling and sharing. The app cannot remotely launch or wake the iPad.

The iPad samples verified WAN byte counters about every two seconds and publishes its latest reading about every five seconds. The phone reads that account's home feed. Only rates, sample time, and an opaque source identifier are stored; router credentials, private gateway addresses, hardware identifiers, and connected-device lists are not sent. A second producer must wait until the previous one has stopped publishing for 30 seconds.

The phone labels the feed **HOME LIVE**, **HOME STALE**, or **HOME UNAVAILABLE**. Server-computed sample age, request duration, and monotonic elapsed time control freshness; readings older than 15 seconds cannot stay live. Previous rates remain visible with an explicit stale label. Incorrect producer clocks and invalid rates are rejected. This measures current usage across the home gateway, not internet-plan capacity or a phone speed test.

## Project setup

Use the existing Supabase project. Copy `.env.example` to an ignored `.env.local` and fill in the project URL and **publishable** key. Do not use a secret key or `service_role` key in the app. Environment values are compiled into the native bundle, so rebuild and copy iOS assets when changing them.

Apply the two SQL migrations in timestamp order. They create `daily_ops_dashboards`, `daily_ops_home_traffic`, owner-only SELECT/INSERT/UPDATE policies, explicit column grants, revision tracking, and security-invoker RPCs. Anonymous access and default function execution grants are revoked. No existing records are deleted. Both tables must have row-level security enabled before exposing app access.

Add `com.dailyops.dashboard://auth/callback` to Authentication → URL Configuration → Redirect URLs. The app uses PKCE for confirmation callbacks and forwards both warm and cold native launches. Native session values and the PKCE verifier use a fixed iOS Keychain entry with `AfterFirstUnlockThisDeviceOnly`; the app never stores the password. Native backups use protected Application Support files. Browser sessions use that browser's local storage.

The default Supabase email service only sends to organization members; use an organization-member email for this personal setup or configure your own SMTP for other recipients. New Free projects cannot customize the default-provider templates. See [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [native auth redirects](https://supabase.com/docs/guides/auth/redirect-urls), and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Acceptance record — 2026-10-10

- TypeScript and production/offline build pass. All 44 unit tests and all 20 dashboard browser tests pass; browser sync uses isolated mock services, not the live project.
- The two-device check covers initial sharing, preserving the tablet copy, edits in both directions, offline reload and recovery, home traffic publication/readback, stale traffic, and local sign-out. Conflict-choice and backup-restore checks also run after the final review interface change.
- Signed iPhone 1.3.0/build 8 compilation passes, including the Keychain bridge and custom URL scheme. The final bundle passed deep/strict signature and asset verification. Daily Ops 1.3.0/build 8 is installed on the physical iPhone; a separate query confirmed it. Saved records are byte-identical after the in-place update. Automatic launch was denied because the phone was locked. A private data backup is retained outside source control.
- Both cloud migrations are deployed in one transaction. Live SQL verification passed: account A can create/update its dashboard, an old revision cannot overwrite it, account B cannot read or change A's records, anonymous access is denied, clients cannot change the server revision, competing traffic producers are guarded, and future samples are rejected. Temporary users and records were rolled back. The unfiltered Supabase Advisor Center reported no issues.
- The exact native redirect `com.dailyops.dashboard://auth/callback` is enabled. The user confirmed Daily Ops 1.3.0 opens on the physical iPhone and Settings → Account & sync appears.
- External API checks confirmed the email provider is enabled, email confirmation is required, and publishable-key requests without a signed-in session receive HTTP 401 for both dashboard and traffic tables.
- The user confirmed **SYNCED** on the iPhone after creating and confirming the app account and sharing its current dashboard. A read-only live SQL check independently found one confirmed account and one valid shared dashboard at revision 1. No home traffic publisher exists yet.
- Daily Ops 1.3.0/build 8 is installed in place on the physical iPad mini 4 running iPadOS 15.8.8. A separate installed-app query confirmed the version and build. Its original dashboard was copied to a private Mac backup before installation, and the saved records are byte-identical after the update.
- The user confirmed **SYNCED** on the iPad after signing into the same Daily Ops account and adopting the shared dashboard. The user then confirmed that a task added on the iPhone appeared on the iPad, and completing it on the iPad appeared on the iPhone. This verifies physical edits in both directions. The check requested cellular use if available; the connection type was not separately reported.
- The user confirmed internet access over Wi-Fi. Task sync requires an internet connection and does not depend on the Mac or modem-counter service.
- Home traffic remains unavailable. The Mac's default route is the home gateway at `10.0.0.1`; bounded SSDP discovery returns no advertisement, and the previously configured service endpoint refuses connections. The user enabled home sharing, but Local Network permission was not confirmed. The user signed into the modem admin page, then closed it and explicitly chose to leave network-speed troubleshooting for now. No modem configuration change was applied by the agent. The optional home feed is not part of completed physical acceptance.

The iPad's initial connection through an Ethernet adapter did not appear as a USB device. After the user reconnected its Lightning USB data cable, the Mac detected the iPad and completed the update. Read-only SSDP discovery received no gateway advertisement, and the previously configured gateway service was unreachable from the Mac. Physical iPad gateway access and home-feed publication must be verified separately; this does not establish whether UPnP, the service address, or the Mac's current network changed.

Supabase provides the hosted database and authentication. The dashboard remains usable offline. Cloud sync is a shared current document, not a full historical backup service; keep periodic exported JSON backups independently.
