# LocalLink 1.2.0

### 搜索本机文件并发送

在设备会话中点击放大镜，输入文件或文件夹名称。可以跨多次搜索勾选项目，查看已选数量，用文件夹图标定位原文件，最后点击「确认发送」。Windows x64 优先复用本机运行中的 Everything。未检测到可用实例时可启动随附的 Everything 1.5 Beta；索引未就绪时可回退到目录扫描。接收端无需安装 Everything。

### 让 AI 客户端使用 LocalLink

在「设置 → MCP」启用访问，把生成的配置复制到支持 stdio 的本机 MCP 客户端。客户端需要支持 node:sqlite 的 Node.js，推荐 Node 24。右键收到的消息或文件即可单项授权，也可在设备详情授权读取来自该设备的已验证收件。附件内容读取可单独关闭。

Agent 可以搜索允许范围内的文件、列出在线且已配对的目标设备，并请求发送文件。默认逐次确认发送。可在 MCP 设置中限制搜索范围。请只把客户端配置交给你信任的本机客户端。

### 连接与性能

- 在设备会话顶部切换传输线路。在「设置 → 诊断」查看各条可用线路的延迟和双向吞吐量。以太网及 USB4／雷电直连需要操作系统已识别相应网络接口。
- 大批量收发时就地更新进度，展开文件明细后复用未变化的卡片，减少发送消息和浏览历史记录时的重复刷新。

### Downloads

Windows x64 users can choose Setup for installation and in-app updates, or Portable for a standalone launcher. On macOS, choose arm64 for Apple silicon or x64 for Intel. SHA256SUMS.txt lists the package digests.

LocalLink 1.2.0 adds sender-side file and folder search, Everything integration on Windows x64, a local stdio MCP server with scoped access and per-device transfer routes. Search results can be selected across queries and sent together after confirmation.
