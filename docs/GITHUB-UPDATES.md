# GitHub updates

Settings → About → Check for updates reads releases from `MostimaJK/LocalLink`.
The repository must be public for unauthenticated clients. No GitHub credentials
are bundled. A private repository, API rate limit or network error is reported as
a failed check, never as “up to date”.

- Checking on startup is opt-in, delayed 10 seconds and throttled to once per six hours.
- Published prereleases are included and labelled; drafts are excluded.
- Versions are compared numerically. Publish a higher version (for example 1.0.1)
  to update 1.0.0 clients; replacing assets under the same tag is not an update.
- Upload both `LocalLink-Setup-VERSION.exe` and `LocalLink-VERSION-Portable.exe`,
  plus `SHA256SUMS.txt` with SHA-256 entries for those exact filenames.
- Downloads go to Downloads/LocalLink Updates. Streaming avoids buffering the
  whole EXE. Cancellation is supported. Missing or incorrect checksums block installation.
- Installer users can run the verified installer. Finish active transfers first;
  this feature does not silently quit the application or install in the background.
- Portable users open the download folder, quit the old app, replace the EXE and
  launch the new one. In-place automatic portable replacement is not implemented.
- Existing user data remains in the existing app-data directory.

The original 1.0.0 binaries did not contain this feature. The November 21, 2026
rebuild adds it while retaining version 1.0.0. Download this rebuild manually;
same-version asset replacements do not trigger an update notification.

Validation: version/transport unit suite; isolated Electron test for About UI,
three languages, installer/portable selection, real main-process download handler
with a fixture HTTP response, SHA-256 success and mismatch, and wrong-repository
rejection, cancellation, unavailable releases and same-version checks. The full
shared unit suite and General settings regression also pass.
Full real-GitHub upgrade installation awaits a public higher-version
release. Fixture tests do not execute installers or discover LAN devices.
