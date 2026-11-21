# GitHub updates

Settings → About → Check for updates reads public releases from `MostimaJK/LocalLink`.
No GitHub credentials are bundled. Network errors and rate limits are reported as
failed checks, never as “up to date”.

- Startup checks are opt-in, delayed 10 seconds and throttled to once per six hours.
- Published prereleases are labelled; drafts are excluded. Versions are compared numerically.
- Publish both `LocalLink-Setup-VERSION.exe` and `LocalLink-VERSION-Portable.exe`,
  both macOS disk images (`LocalLink-VERSION-arm64.dmg` and `LocalLink-VERSION-x64.dmg`), and a single `SHA256SUMS.txt` for all four files.
- Downloads stream to Downloads/LocalLink Updates. Cancellation is supported.
  Missing or incorrect checksums block installation; the staged file is checked again.
- macOS selects the disk image for the current CPU. After verification, open the download folder and install the update manually.
- On Windows, choose **Update and restart** after downloading. Active transfers or calls block
  this action so they are not interrupted.
- Setup: a helper waits for the app to quit, runs the installer silently into the
  current installation directory, then launches the updated app with the same data path.
- Portable: a helper waits for exit, replaces the original EXE in its existing
  location and starts it again. The directory must be writable. The previous EXE
  remains as `.previous-<id>` for recovery. If startup is not acknowledged within
  90 seconds, the helper attempts to restore and launch that backup.
- Update job logs are in `<userData>/locallink-updates/<id>`. Installer failures
  are reported but do not have the portable binary rollback mechanism.
- Manual download/replacement remains available. User data stays in the existing
  app-data directory. No automatic reboot of Windows is performed.

The refreshed 1.0.1 packages introduce this restart flow. **Existing 1.0.1 clients
must download this rebuild manually once**: replacing assets under the same tag
does not trigger a newer-version notification. Subsequent higher-version releases
can use the in-app update flow.

Validation includes checksum rejection, Unicode paths, waiting for exit, portable
replacement/relaunch and failed-start rollback with isolated executable fixtures.
Packaged smoke tests use real Windows executables and isolated app data; download
responses are supplied locally rather than downloading a higher public version.
Full shared unit and desktop release regression tests also pass. This does not
certify every antivirus configuration, filesystem, or machine-wide installation.
