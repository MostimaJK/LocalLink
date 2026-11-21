# LocalLink 1.0.2 · Windows 与 macOS 桌面预览版

- 新增 Apple Silicon 和 Intel Mac 安装包，支持原生窗口按钮和从 Dock 恢复窗口。
- 发送文件夹时可查看扫描数量和打包字节进度，取消后自动回收本次临时 ZIP。
- 附近发现的 UDP 端口被占用时仍可手动收发文件。「连接设备」可以复制本机实际 IP 与端口。
- 旧版 P2P 会在接收方校验文件摘要，校验失败时提示重发。

| 平台 | 安装包 |
| --- | --- |
| Windows x64 安装版 | LocalLink-Setup-1.0.2.exe |
| Windows x64 免安装版 | LocalLink-1.0.2-Portable.exe |
| Apple Silicon Mac | LocalLink-1.0.2-arm64.dmg |
| Intel Mac | LocalLink-1.0.2-x64.dmg |

SHA256SUMS.txt 包含四个安装包的 SHA-256。Windows 安装包未签名。Mac 应用使用临时签名，尚未经过 Apple 公证。Mac 用户可打开对应磁盘映像，将 LocalLink 拖入「应用程序」。本版没有 Android 或 iOS 安装包。

## English

Desktop preview for Windows x64, Apple silicon and Intel Macs. This version adds cancellable folder packing, manual connections during multicast outages and stricter legacy file verification. The native macOS workflow mounts each DMG and exercises startup, window handling, updates and loopback transfers. Physical Mac–Windows LAN testing remains pending.
