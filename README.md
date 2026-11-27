# LocalLink

[繁體中文](README.zh-TW.md)

LocalLink shares files, folders and text across a local network. **Desktop release 1.1.0** targets Windows x64 and macOS.

## Download

Choose a package from the [GitHub Releases page](https://github.com/MostimaJK/LocalLink/releases).

| Computer | Package |
| --- | --- |
| Windows x64 | `LocalLink-Setup-1.1.0.exe` or `LocalLink-1.1.0-Portable.exe` |
| Mac with Apple silicon | `LocalLink-1.1.0-arm64.dmg` |
| Intel Mac | `LocalLink-1.1.0-x64.dmg` |

The release includes SHA256SUMS.txt for all four packages. Windows builds are unsigned. Mac builds use ad-hoc signatures and have not been notarized by Apple. On Mac, open the matching DMG and drag LocalLink to Applications.

Folders transfer directly and retain their relative paths. If delivery confirmation is lost between two desktops running 1.0.8 or later, retry checks the receiver’s saved copy before uploading again. If nearby discovery is unavailable, open **Connect device** to copy the address and port for a manual connection. [Release notes](docs/RELEASE-NOTES-1.1.0.md)

If a 1.0.7 Windows update downloads but does not restart, exit LocalLink completely and run the verified Setup in the update folder, or replace the old Portable executable with the new Portable package.

In the Windows Setup edition, open **Settings → About → Check for updates** and choose **Download, install and restart**. Finish active transfers first. If installation is interrupted, return to About to review the result and retry the verified package.

## Features

Nearby discovery, favorites, aliases, files, images, folders with their directory structure and native LocalLink text. Includes progress, cancellation, retry, history, backups, receive-folder selection, pairing, authorized auto-receive, bandwidth limits and Windows adapter information.

File sizes are limited by available storage and system limits. English is the default for new profiles. Traditional Chinese and Simplified Chinese are available in Settings → General. Existing preferences are preserved.

In Device details, use **Remove trust** beside the trust status to revoke pairing. For multi-phone sharing, use the QR panel to invite phones and choose files. Open the group conversation to see shared files and messages.

## Screenshots

Traditional Chinese interface with demonstration data:

![Device conversation](docs/screenshots/device-conversation.png)
![General settings](docs/screenshots/general-settings.png)

## Run from source

```powershell
git clone https://github.com/MostimaJK/LocalLink.git
cd LocalLink
npm --prefix desktop ci
npm start
```

Windows users can also run `Start-LocalLink.bat`.

Choose **Share with phone**, scan the QR and enter the six digits shown on the computer. By default up to eight browsers can scan the same QR within 15 minutes. Turn off **Allow multiple phones** before starting for a private session. Members share a temporary group chat. Each recipient chooses whether to accept a file; the computer relays group uploads. All paired phones can download the files you select. Upload approvals are separate for each browser. Dismiss the QR panel to continue using the desktop app. Use the sharing indicator in the title bar to reopen the panel, or choose files there directly. An unused pairing code expires after 15 minutes. After pairing, sharing continues until you select End sharing or quit LocalLink. Minimizing the app or hiding it in the tray keeps sharing active. Each session accepts up to 100 uploads totaling about 1.07 GB.

HTTPS deployments set `LOCALLINK_SHARE_HOST` to a hostname that resolves on the phone to the selected LAN address, `LOCALLINK_SHARE_CERT` to its PEM certificate chain and `LOCALLINK_SHARE_KEY` to its PEM private key before launching LocalLink. The phone must trust the certificate issuer. An invalid configuration stops sharing. Without TLS configuration, starting unencrypted HTTP requires explicit confirmation each session. Use HTTP only on a trusted private network for non-sensitive files.

For Windows development, use `npm start` to try changes directly. Run `npm --prefix desktop run test:windows:preflight` for file handling, discovery recovery and updater checks. When both Windows packages are needed, `npm --prefix desktop run build:win:both` packages the app once and writes Setup and Portable to `desktop/dist/windows/`.

## macOS development preview

On a Mac, use the source commands above. To build a disk image for the current CPU, run
`npm run desktop:build:mac -- --arm64` on Apple Silicon or `npm run desktop:build:mac -- --x64` on Intel.

The manual **Build and test macOS candidates** workflow builds on both architectures, mounts each DMG and exercises file transfers from the packaged app. Its artifacts are development candidates. Physical LAN discovery and Mac–Windows interoperability still need a two-device test.

## Limitations

Desktop folder transfers and file batches have no fixed entry count. Incoming batches above 10 GB require confirmation by default, including trusted devices. The threshold is configurable. Desktop builds send folder contents directly with relative paths and skip empty folders. Update both LocalLink peers for directory support. Interrupted files restart from the beginning. A completed file can be acknowledged on retry. Calls remain in the legacy transport. Tested with 600 MiB loopback transfer, not 50 GB or full physical cross-platform validation. No mobile binaries.

## Licensing

Based on Orbit, inspired by LocalSend; no official affiliation. Retained [MIT license](LICENSE), [dependency notices](desktop/THIRD-PARTY-NOTICES.txt) and [security policy](SECURITY.md). See the [1.1.0 release notes](docs/RELEASE-NOTES-1.1.0.md).
