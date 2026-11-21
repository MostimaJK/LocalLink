# LocalLink

[English](README.md)

以裝置為中心的區域網路傳輸工具，透過聊天式時間軸查看收發內容。**1.0.1 為 Windows x64 預覽版。**

## 下載

前往 [Releases](https://github.com/MostimaJK/LocalLink/releases)。Portable.exe 為免安裝版，設定與歷史仍保存在本機使用者資料目錄；Setup.exe 為安裝版。SHA256SUMS.txt 提供校驗值。Windows 程式尚未簽章，請確認來源可信。

## 功能

1.0.1 新增已信任裝置的藍色盾牌、自動接收開關及可信裝置管理。
詳見[發行說明](docs/RELEASE-NOTES-1.0.1.md)。「設定 → 關於」支援 GitHub 更新檢查與校驗下載；
啟動檢查可自行開啟。安裝版與免安裝版均可在校驗下載後選擇「更新並重新啟動」。
接收檔案直接儲存到指定資料夾；同名檔案自動編號，不覆蓋既有內容。

附近裝置探索、收藏與備註；檔案、圖片、資料夾 ZIP 與文字；進度、取消、重試、歷史、備份、接收目錄、配對授權、收發限速及網卡資訊。

不設固定容量上限，仍受磁碟與系統限制。新使用者預設英文，可在 **Settings → General → Interface language → 繁體中文** 切換。既有偏好保留，亦支援簡體中文。

## 介面預覽

以下為示範資料。

![裝置傳輸時間軸](docs/screenshots/device-conversation.png)
![通用設定](docs/screenshots/general-settings.png)

## 執行原始碼

```powershell
git clone https://github.com/MostimaJK/LocalLink.git
cd LocalLink
npm --prefix desktop ci
npm start
```

Windows 亦可執行 Start-LocalLink.bat。

## 限制

每批 100 個檔案、資料夾 10000 個項目；ZIP 需要額外空間。重試從頭傳送，預設協定尚無斷點續傳，通話仍在舊協定。已驗證 600 MiB 本機傳輸，未做 50 GB 或完整跨平台實機驗收。本次僅提供 Windows x64 程式。

基於 Orbit 開發，靈感來自 LocalSend，無官方關聯。保留 [MIT 授權](LICENSE) 與 [第三方聲明](desktop/THIRD-PARTY-NOTICES.txt)。
