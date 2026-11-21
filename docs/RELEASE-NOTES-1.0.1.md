# LocalLink v1.0.1 — Trusted devices and smoother transfers (Windows Preview)

- Paired devices show a blue shield. Click it or open Device details to manage automatic receive or remove trust, including offline devices.
- Settings → General → Receiving and saving includes a trusted-device manager. Favorites never grant trust; unknown devices still require confirmation.
- Received files now save directly into your chosen folder. Existing names receive a numbered suffix, such as `setup (1).exe`; existing files are never overwritten. Temporary files are removed after completion or failure.
- Verified downloads now offer **Update and restart** for both Setup and Portable. The app keeps its data path, waits for transfers/calls to finish, and restarts the updated executable. Portable updates retain a backup and attempt rollback if the new app fails to start.
- Existing receive folders and historical records are left intact. Folder transfers remain lossless ZIP archives, not automatically extracted directories.

## Download and update

Windows x64 only. Setup installs the app; Portable runs without installation.
SHA256SUMS.txt contains checksums. Binaries are unsigned; this remains a preview.
The repository is public and supports anonymous in-app release checks.

**This is a refreshed 1.0.1 build. If you already have 1.0.1, manually download
this rebuild once. Same-version replacements do not trigger update notifications.**
Future higher versions can use Update and restart. Existing local data is retained.

## Validation and limits

Checks cover local HTTPS pairing and byte-exact transfers, duplicate names,
checksum failure, remembered receive consent, revocation, spoof rejection, offline
management, restart persistence and all three interface languages. The shared unit
suite and 16 desktop release E2E tests pass. Update helpers are exercised with
isolated executables, including failed-start rollback and Unicode paths.
Local tests do not replace two-computer testing or cross-platform certification.
Pairing grants local receive permission only. Resume is not implemented.

## 繁體中文

- 已信任裝置顯示藍色盾牌，可管理自動接收或解除信任；收藏不代表信任。
- 接收檔案直接存入指定資料夾，不再為每次傳輸建立額外資料夾。同名檔案自動編號，不覆蓋原檔。
- 安裝版與免安裝版下載校驗後，可選擇「更新並重新啟動」。有傳輸或通話時會阻止更新；既有設定與記錄保留。
- 免安裝版保留舊 EXE 備份，新程式啟動失敗時嘗試回復。原有接收資料夾與歷史記錄不搬動；資料夾傳輸仍儲存為無損 ZIP。

僅提供 Windows x64，仍為未簽章預覽版。倉庫已公開。
**已安裝 1.0.1 的使用者，請手動下載此次重建版本一次；同版本不會觸發更新提示。**
之後較高版本可使用程式內更新。配對授權僅影響本機接收，尚未支援斷點續傳。
