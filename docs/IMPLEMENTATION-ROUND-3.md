# 第三轮：Electron 升级与传输完善

版本：LocalLink 1.1.0，2026-11-21。接续 3a03637；第二轮文档为历史快照，本轮状态以本文为准。

## 已实现

- Electron 32.3.3 → 45.4.1；electron-builder 26.18.0；better-sqlite3 13.2.0（Node-API 预编译模块）。保留包名、appId、默认 userData、orbit.db 和证书路径。修复 BAT 依赖检查，不再因新版 SQLite 没有 build/Release 而重复安装。
- 移除弃用的直接依赖 rcedit；新版构建器用 resedit 修改 Windows 元数据。固定 minimatch 11.0.1，更新兼容间接依赖。完整 desktop npm audit 当前 0 漏洞，报告见 artifacts/dependency-audit-round3.json。
- 遍历活动非回环 IPv4 网卡，分别加入组播并逐个接口广播；每次公告重新检查网卡，退出已移除接口、加入新增接口。异步发送完成后再切换出口，避免公告都走最后一块网卡。无手动网卡选择、IPv6 或自动 HTTP 扫描回退。
- 对话底部增加文件夹按钮：选择目录后生成无压缩 ZIP，再通过现有 LocalSend 传输。保留文件字节、目录结构、空目录和 Unicode 名称；不自动解压。拒绝符号链接，最多 10,000 个条目；原始总大小及 ZIP 大小均不得超过当前 500 MiB 上限。构建失败清除本次临时目录。文件夹拖放尚未接入，请使用文件夹按钮。
- 全部历史增加设备、日期、状态、文件类型筛选，可与原有文件名/方向组合使用，仍每页 100 条。图片类型目前覆盖 PNG/JPG/JPEG/WebP/GIF，文字为 TXT，归档为 ZIP/7z/RAR，按扩展名分类。
- 历史支持单个或勾选多个已接收文件清理。确认框列出名称及完整路径，默认取消；使用系统回收站，保留历史、清空可打开路径。不会清理发送端原文件。删除记录与清理实际文件为不同操作。批量操作范围为当前页勾选项目。
- 默认外观页改为完整三语的主题、配色、文字大小、缩放及减少动态效果；沿用现有设置卡片与选择器。旧连接界面补译 111 处静态标签/说明，覆盖外观、网络、通知、安全和数据工具，保留选项存储值。三语测试检查切换和持久化。未宣称所有旧界面/系统错误都已翻译。

## 构建和使用

- 根目录 Start-LocalLink.bat；--check 验证 Electron 能加载 SQLite。
- desktop 内 npm run build:win:installer：生成 dist/installer/LocalLink-Setup-1.1.0.exe。
- npm run build:win:local：生成 dist/win-unpacked/LocalLink.exe，必须保留整个目录。
- 初次安装依赖需 Node >=22；本机使用 Node 24。npm ci 后运行 node node_modules/electron/install.js、npx --no-install electron-builder install-app-deps。
- 新构建器下载工具若卡住，可运行 scripts/prepare-windows-tools.ps1，从官方 electron-builder-binaries 下载固定 NSIS/7zip 工具，先验证 SHA-256 再解压。安装包脚本自动使用这些本地工具；不修改系统权限、代理或校验策略。
- 明确排除 dist/**，避免把旧安装包和构建工具再次打进新安装包。未签名，不带自动更新，也未发布到网络。

## 验证

- Electron 45 下原有 8 项重点界面回归通过：窗口、语言、设备、LocalSend 会话、传输控制和工作流。
- 新增外观/旧设置三语测试；增强工作流测试实际传输文件夹 ZIP、按状态筛选、将临时接收文件移到 Windows 回收站，并确认发送源文件仍存在。
- round3.test.cjs：原始字节、Unicode/空目录 ZIP、大小上限、模拟多网卡加入/移除/切换。
- transfer-storage.test.js：真实 SQLite 的旧 JSON 记录迁移、组合/日期边界/类型筛选、备份恢复及失败事务回滚。
- 协议与任务测试：独立 HTTPS 两端、字节一致、确认、拒收、token/哈希/证书校验、手动发现、批量/空文件、超时、取消通过。
- installer-lifecycle.cjs：独立 dev.locallink.install-verification 应用标识，临时目录，首次安装 1.0.0、覆盖安装 1.1.0、启动、卸载；设备 ID、名称、语言、收藏、TLS 证书、旧格式历史保留；卸载不删除测试数据。未操作用户正式数据库。两个测试版本都用当前 Electron 45 和源码构建，旧格式由 seed-legacy-transfer.cjs 注入；不是实际 Electron 32 发布包到 45 的完整升级测试。
- packaged-smoke.cjs：实际运行打包 EXE，验证 SQLite 改名、繁体默认语言、独立 userData 和随包许可证。
- artifacts/history-round3.png、appearance-round3.png、transfer-workflow-*.png 为真实 Electron 截图。

## 仍有边界

- npm ci 仍有构建工具间接依赖的弃用提示：@electron/asar 3 的 glob 7/inflight，Squirrel 的 temp/rimraf 2，以及下载器的 global-agent/boolean。已定位来源，audit 为 0；不强行跨主版本替换不同 API 来隐藏提示。生产传输路径不使用这些构建工具。npm 对构建依赖安装脚本的 allow-scripts 提示也不等于漏洞。
- 多网卡目前是模拟拓扑验证；真实 Wi-Fi/有线/VPN 并存、换网、原版 LocalSend Windows/Android 双机互传仍需真机验收。
- 清理为用户主动清理接收文件；生成 ZIP/粘贴内容的 outbox 缓存仍需保留以便重试，尚无自动清理或保留期限策略。
- 旧模式部分下拉选项、动态提示、系统异常文本仍可能英文；本轮补译静态设置说明，不能称全应用 100% 本地化。
- 断点续传、离线待发送、配对自动接收、Android 新网络层、多端历史同步等仍未实现；此次没有扩大这些能力声明。
