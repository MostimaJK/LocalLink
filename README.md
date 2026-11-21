# LocalLink

[繁體中文](README.zh-TW.md)

Device-centered LAN sharing with a conversation-style timeline. **1.0.0 is a Windows x64 preview release.**

## Download

[Releases](https://github.com/MostimaJK/LocalLink/releases)

- **LocalLink-1.0.0-Portable.exe**: no installation; settings and history remain in the local user-data directory.
- **LocalLink-Setup-1.0.0.exe**: installer with shortcuts.
- **SHA256SUMS.txt**: SHA-256 checksums.

Windows binaries are unsigned. Only run downloads from a source you trust.

## Features

Nearby discovery, favorites, aliases, files, images, folders as ZIP and native LocalLink text. Includes progress, cancellation, retry, history, backups, receive-folder selection, pairing, authorized auto-receive, bandwidth limits and Windows adapter information.

No fixed file/batch capacity cap; disk and system limits apply. English is the default for new profiles. Traditional Chinese and Simplified Chinese are available in Settings → General. Existing preferences are preserved.

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

## Limitations

100 files per batch, 10,000 folder entries. ZIP needs extra disk space. Retry starts over; no resume in the default protocol. Calls remain in the legacy transport. Tested with 600 MiB loopback transfer, not 50 GB or full physical cross-platform validation. No mobile binaries.

## Licensing

Based on Orbit, inspired by LocalSend; no official affiliation. Retained [MIT license](LICENSE), [dependency notices](desktop/THIRD-PARTY-NOTICES.txt) and [security policy](SECURITY.md). See [release readiness](docs/RELEASE-READINESS.md).
