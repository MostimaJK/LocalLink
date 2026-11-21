# LocalLink

以设备为中心的局域网文件传输工具，保留聊天式时间线，方便按顺序查看发送与接收内容。

版本号为 **1.0.0**。当前面向 **Windows x64 的发布候选开发版本**，尚未完成全部真实双机与安装发行验收，不把版本号当作正式稳定认证。

## 功能

- 附近设备发现、手动 IP 连接、设备收藏与本机备注。
- 文件、图片、批量文件、文件夹 ZIP 传输；原文件不静默压缩或转码。
- LocalLink 客户端之间发送原生文字；兼容 LocalSend 文件传输协议。
- 聊天式时间线、实际传输进度、取消、重试、历史搜索与文件位置操作。
- 指定接收目录，配对并授权的设备可自动接收。
- 发送/接收独立限速，多个任务共享同方向额度。
- Windows 网卡类型、连接状态和链路理论速率检测（不是实际带宽测速）。
- 繁体中文（默认）、简体中文、英文，深浅色主题。

## 从源码运行

需要 Windows、Node.js/npm 和 Git。首次运行需要联网安装依赖。

```powershell
git clone <你的仓库地址>
cd LocalLink
npm --prefix desktop ci
npm start
```

也可以双击根目录的 `Start-LocalLink.bat`；缺少依赖时会自动安装。数据目录沿用旧应用标识以保护现有资料，改名不会自动迁移或清空历史。

## 验证与限制

```powershell
npm ci
npm run test:unit
npm --prefix desktop run test:release
```

默认协议不设固定文件/批次容量上限，仍受磁盘、文件系统与安全数值范围限制。失败重试从头发送，尚不支持默认协议断点续传。语音视频保留在旧协议路径，未统一到默认 LocalSend 连接。Android 代码保留但未完成新协议发行验收；没有可发布的 LocalLink iOS 客户端。

当前检测主要是 Windows 本机自动化与回环 HTTPS 测试，真实 LocalSend Windows/Android/iOS 双机互通、长时间弱网、安装升级和签名仍须发布前验收。详情见 [发布检查](docs/RELEASE-READINESS.md) 与 [性能记录](docs/PERFORMANCE-AND-BANDWIDTH.md)。

## 来源与许可

项目使用 MIT 许可证；保留 [LICENSE](LICENSE) 与 [第三方许可清单](desktop/THIRD-PARTY-NOTICES.txt)。基于 Orbit 开发，灵感来自 LocalSend，均无官方关联。上游资料存于 [历史参考](docs/upstream/README.md)，其中的发布声明不适用于 LocalLink。

安全问题请阅读 [SECURITY.md](SECURITY.md)。不要将本地数据、TLS 私钥或签名凭据提交到 GitHub。
