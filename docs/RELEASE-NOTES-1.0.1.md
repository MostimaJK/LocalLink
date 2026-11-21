# LocalLink v1.0.1 — Trusted devices (Windows Preview)

- Paired devices now show a blue shield. The tooltip distinguishes automatic receiving from confirmation on each transfer.
- Click the shield or open Device details to enable automatic receive or remove trust, including for offline devices.
- Settings → General → Receiving and saving includes a trusted-device manager.
- An authenticated paired sender's receive prompt can remember automatic receive permission. Unknown senders are still confirmed individually; favorites never grant trust.
- Trust changes update the interface immediately and persist across restarts. Revoking trust restores receive prompts for future transfers.

## Download and update

Windows x64 only. Setup installs the app; Portable runs without installation.
SHA256SUMS.txt contains checksums. Binaries are unsigned; this remains a preview.
Version 1.0.1 is newer than 1.0.0. In-app GitHub checks require a public release repository;
while the repository is private, download manually using an authorized GitHub account.
Portable updates require quitting and replacing the EXE. Existing local data is retained.

## Validation and limits

The release checks include real local HTTPS pairing and file transfer, remembered
receive consent, revocation, certificate spoof rejection, offline management,
restart persistence and all three interface languages. Local tests are not a
substitute for two physical computers or full cross-platform certification.
Pairing permissions are local to each receiving computer and require LocalLink peers;
they do not grant permissions on the other device. Already accepted transfers are
not cancelled by revocation. Existing transfer limits and lack of resume remain unchanged.

## 繁體中文

- 已信任裝置顯示藍色盾牌，提示文字區分自動接收與逐次確認。
- 點擊盾牌或裝置詳情，可切換自動接收或解除信任，離線裝置亦可管理。
- 通用設定新增「管理可信裝置」。已配對裝置的接收提示可勾選「以後自動接收」。
- 收藏不代表信任；解除信任後，之後的傳輸恢復接收確認。設定會保留至重新啟動後。

僅提供 Windows x64，仍為未簽章預覽版。安裝版與免安裝版使用相同功能。
倉庫私有時須登入有權限的 GitHub 帳號手動下載；公開後才可供程式匿名檢查更新。
免安裝版需退出後替換 EXE，既有本機資料保留。配對授權只影響本機接收，
不會自動授權另一台裝置，也不會取消已接受的傳輸。
