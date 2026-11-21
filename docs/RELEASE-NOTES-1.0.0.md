# LocalLink v1.0.0 — Windows Preview

Device-centered LAN sharing with a conversation-style timeline.

- Files, images, folders as ZIP, native text, history and backups.
- No fixed capacity cap; disk and system limits apply.
- Receive-folder selection, pairing, bandwidth limits and adapter information.
- English default for new profiles; Traditional Chinese and Simplified Chinese available. Existing preferences are preserved.

## Downloads

### November 21, 2026 rebuild

- GitHub update checking and verified downloads in Settings → About. Startup checks are opt-in; public releases are required. Portable replacement remains manual.
- General settings now start with language, receiving/storage, and device name. Adapter information is at the bottom; the capacity-limit row is removed.
- Removed 55 decorative desktop avatar frames (55.6 MiB of uncompressed assets).
- Isolated desktop UI tests from LAN discovery to avoid leaving test devices in real histories.
- Version remains 1.0.0. Download this rebuild manually; same-version replacement does not trigger update notifications.
- Windows x64 Setup: 148,520,696 bytes (141.6 MiB); Portable: 191,894,191 bytes (183.0 MiB).
- Validation: shared unit suite, release transport/storage tests, 14 UI regressions, updater test, unpacked application and Portable EXE smoke tests passed. This does not certify an in-place installer upgrade on every machine.

Portable.exe runs without installation and retains local user data. Setup.exe installs the Windows x64 app. SHA256SUMS.txt provides SHA-256 checksums. Binaries are unsigned.

## Known limitations

100 files per batch, 10,000 folder entries; ZIP requires extra disk space. No resume in the default protocol; calls remain legacy-only. Tested with 600 MiB loopback transfer, not 50 GB or full physical cross-platform validation. No mobile binaries. This is a preview, not a claim of completed installation/upgrade certification.

## 繁體中文

2026 年 11 月 21 日重建：新增「關於」中的 GitHub 更新檢查與校驗下載；調整通用設定順序；移除 55 張桌面頭像框裝飾；隔離測試裝置探索。版本仍為 1.0.0，請手動下載此次重建版本，同版本替換不會觸發更新通知。免安裝版仍需手動替換檔案。

Windows 預覽版：裝置探索、聊天式傳輸時間軸、檔案、資料夾 ZIP、文字、歷史與備份。不設固定容量上限，保留限速與配對授權。

新使用者預設英文，可在 Settings → General 切換繁體中文。已有偏好保留。Portable 為免安裝版，Setup 為安裝版，皆尚未簽章。

每批 100 個檔案、資料夾 10000 個項目。ZIP 需要額外空間，尚無預設協定斷點續傳，通話仍在舊協定。已完成 600 MiB 本機測試，未完成 50 GB 或完整跨平台實機驗收。
