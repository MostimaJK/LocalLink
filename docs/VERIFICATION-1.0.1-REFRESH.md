# 1.0.1 refresh verification — 2026-11-21

Runtime changes: flat receive paths with no-overwrite collision numbering; verified
Windows update/restart helper; active transfer/call guard; portable rollback.

Passed locally on Windows x64:
- `npm run test:unit` (shared suites).
- `npm --prefix desktop run test:release` (protocol/storage/network suites and 16 E2E cases).
- `node tests/receive-file.test.cjs`: concurrent collisions and hard-link fallback.
- `node tests/update-restart.test.cjs`: checksum refusal, exit wait, Unicode paths,
  successful replacement and failed-start rollback using executable fixtures.
- `npx playwright test tests/e2e/update-notice.spec.js`: download/checksum/UI errors.
- `node tests/portable-update-smoke.cjs`: packaged IPC download and active-call
  refusal, then verified real Portable replacement/start with identity/settings retained.
- `node tests/installer-update-smoke.cjs`: separate verification application ID,
  silent Setup reinstall, real restart/ready marker, retained identity/settings,
  and test-only uninstall. Production installation and user data were untouched.

Packaged restart tests invoke the helper outside Playwright's owned process tree,
which Playwright terminates when its Electron session exits. Download data comes
from local fixture responses; no public higher-version release was fabricated.
Tests disable LAN discovery and use separate temporary user-data directories.
The final runtime ASAR in both production packages contains the tested helper.

Reproduce packaged tests from `desktop/` after building outputs
`dist/refresh-1.0.1-installer`, `dist/refresh-1.0.1-portable`, and
`dist/update-verification` (the latter via `build-installer.cjs 1.0.1 --verification`).
The Portable baseline defaults to `release/1.0.0`; override with
`LOCALLINK_OLD_PORTABLE` and `LOCALLINK_NEW_PORTABLE` for other fixture versions.

Limits: unsigned Windows preview; no new physical two-computer certification,
no universal antivirus/machine-wide-install guarantee, no resumable transfers.
The same-version refresh requires manual download for existing 1.0.1 clients.
