# Continue Daily Ops on the Mac

Prepared 2026-10-08 for a 2019 Intel MacBook Pro running macOS Sequoia 15.7.7. The source snapshot is Daily Ops 1.1.2, with a working browser app and Android wrapper. The iPad port and live modem integration are still to be implemented.

## 1. Copy the project

Transfer `daily-ops-mac-handoff-2026-10-08.zip` from Windows to the Mac using a USB drive or your preferred file transfer. Double-click the ZIP and place its `daily-ops` folder in `Projects` inside your Mac home folder:

```text
~/Projects/daily-ops
```

The ZIP includes source code, tests, documentation, public assets, Android source, and the dependency lockfile. Dependencies, generated builds, local SDK settings, APKs, private backups, and Git metadata are omitted. Dependencies must be installed on the Mac; copying Windows `node_modules` would bring the wrong platform binaries.

There is no configured Git remote in the Windows checkout at handoff time. This ZIP does not upload or publish anything. Copying it does not automatically synchronize future changes between computers.

## 2. Install Node.js

Install **Node.js 24 LTS** using the [official download page](https://nodejs.org/en/download). Choose macOS and the Intel/x64-compatible installer. Reopen Terminal after installation, then check:

```sh
node --version
npm --version
```

The project requires Node 22.12 or newer; `.nvmrc` selects Node 24. The commands below use the project's exact pnpm version through `npx`, so a global pnpm install is not required. Initial dependency installation needs internet access.

## 3. Install dependencies and start the dashboard

Open Terminal and run:

```sh
cd ~/Projects/daily-ops
npx --yes pnpm@10.28.2 install --frozen-lockfile
npx --yes pnpm@10.28.2 dev
```

Open **http://localhost:5173/** on the Mac. Keep that Terminal window open while using the development server. Stop it with **Control+C**. `start.cmd` is for Windows; use the commands above on macOS.

For subsequent starts:

```sh
cd ~/Projects/daily-ops
npx --yes pnpm@10.28.2 dev
```

To try the browser dashboard on the Ethernet-connected iPad, use the Mac's **Network** URL printed by the server, on the same home LAN. `localhost` on the iPad refers to the iPad, not the Mac. This is a server-hosted preview; a plain LAN HTTP address is not an offline iPad installation. Older Safari compatibility still needs testing.

## 4. Continue with Codex

The Terminal route can be used without depending on the desktop app download's Mac architecture support. From the project folder, in a separate Terminal window:

```sh
cd ~/Projects/daily-ops
npx --yes @openai/codex
```

Choose **Sign in with ChatGPT** and use your account. The Codex IDE extension is another option if you already use a supported editor. See the [official Codex CLI guide](https://learn.chatgpt.com/docs/codex/cli).

Give Codex this instruction:

> Read README.md, docs/MAC-HANDOFF.md, and docs/IPAD-NETWORK-DASHBOARD.md. Continue this existing Daily Ops project on this Mac. Verify the web app and tests first, then prepare the iPad mini 4 port while preserving the Android app and saved-data format. Inspect available tools before installing anything. Use real router data only after verifying what the XB10 exposes. The handoff records the work already completed and the remaining questions.

The ZIP includes a project handoff, not this chat's full history or a Codex session. Starting a new Mac session with the handoff gives the agent the relevant project context.

## 5. Verify the checkout

From another Terminal window in the project folder:

```sh
npx --yes pnpm@10.28.2 typecheck
npx --yes pnpm@10.28.2 test
npx --yes pnpm@10.28.2 build
```

For browser checks after the build:

```sh
npx --yes pnpm@10.28.2 exec playwright install chromium
npx --yes pnpm@10.28.2 test:browser
```

These commands have not yet been executed on this Mac. Historical Windows and Android results are in the README and Android verification report.

## 6. Prepare Xcode when starting the native iPad port

Install **Xcode 26.3** from [Apple developer downloads](https://developer.apple.com/download/all/) using your Apple Account. Apple's [compatibility table](https://developer.apple.com/xcode/system-requirements) lists this release as supporting macOS Sequoia 15.6 onward, iPadOS 15 deployment, and iOS 15+ devices. It meets Capacitor 8's Xcode 26+ requirement. The newest App Store release may require a newer macOS version.

Open Xcode once to complete its initial setup. Connect and unlock the iPad when ready for device testing. There is no `ios/` project to open yet: the native storage and device adapters must be ported before the iPad build can be considered working. The Mac agent can inspect Xcode and guide signing and installation. Signing/provisioning lifetime must be checked for the selected Apple account; installing the app is not by itself a promise of permanent provisioning.

Xcode is not required to run the browser dashboard. The Mac is needed for native builds and installations, and only needs to remain running during normal use if it also hosts the browser app or a network collector.

## Saved records are transferred separately

The ZIP contains application code, not personal tasks, counters, themes, or mileage stored on your tablet/browser. To move those records, use **Settings → Export backup** in the existing dashboard, transfer that JSON file privately, and use **Settings → Restore backup** in the new browser or app. Restore replaces the destination records after confirmation.

Keep personal backup files outside the source folder. Moving files or opening this chat on another computer does not automatically move local dashboard data.
