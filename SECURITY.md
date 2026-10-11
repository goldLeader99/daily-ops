# Security notes

This repository is public. Keep app passwords, modem credentials, access and refresh
tokens, database passwords, signing certificates, private keys, and personal
dashboard records out of commits, issues, screenshots, and logs.

Copy `.env.example` to `.env.local` for local builds. The example contains only
placeholders. Use a Supabase **publishable** key in the app; never use a secret or
service-role key. Every account's database records must remain protected by
row-level security. See [cloud setup and verification](docs/CLOUD-SYNC.md) and the
[Supabase quickstart](docs/SUPABASE-QUICKSTART.md).

Native auth sessions are kept in the iOS Keychain. Browser sessions use local
storage, so protect the browser profile and device. App passwords are submitted
to Supabase Auth and are not saved with dashboard records. Local dashboard
exports and pre-sync copies contain private records; store them outside the
repository. Ignoring a file does not remove it from earlier Git history.

Before publishing changes, review the files being committed, scan the source and
Git history for credentials, run a dependency audit, and run the relevant tests.
The lockfile pins patched build dependencies through `pnpm.overrides`; retain
those pins until upstream dependencies resolve safe versions themselves.

If a real credential is published, revoke or rotate it immediately, then remove
it from the source and affected Git history. Do not paste the credential into a
public report.
