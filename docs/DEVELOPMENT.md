# LocalLink 开发说明

调查日期：2026-11-21（Asia/Shanghai）。首阶段目标是 Windows 可运行的小步改造，不发布安装包。

## 来源与运行

- 上游：https://github.com/D4niel-dev/Orbit
- 基准：`a5ced4a95ac0f84b351c475370fe1b6cea1e1101`；完整克隆，523 个历史提交；远端 `upstream`，分支 `locallink/phase-1`。
- 克隆前目录为空，工作目录及已检查的父级没有 AGENTS.md；源码中也未发现该文件。
- MIT `LICENSE` 原样保留，版权为 D4niel-dev & Orbit Team。未发现上游 NOTICE。
- Electron 32、原生 JS/CSS、better-sqlite3、electron-store；Android 为 Capacitor 8 + Java 插件。Windows/macOS/Linux 有 builder 配置；本轮仅 Windows 运行验证。

```powershell
npm ci
npm ci --prefix desktop
# 若当前 npm 策略未执行依赖安装脚本：
node desktop/node_modules/electron/install.js
cd desktop
npx --no-install electron-builder install-app-deps
cd ..
npm start
```

原生 SQLite 必须匹配 Electron ABI。根目录启动脚本已修复为调用 desktop 的 npm script。现有 appId、package name、数据库文件、协议及 Android 包名不变；未运行迁移，也未生成安装器。不要与 Orbit 同时运行，仍共用端口和原有数据标识；需要隔离试用时从 desktop 执行 `npm start -- --user-data-dir=D:\LocalLink-TestData`。

## 确定的产品边界

沿用 Orbit 布局、浅深主题、文字/图片/文件时间线及语音视频通话。设备身份独立于名称和 IP。设备备注只在本机生效。发现、连接、配对和接收授权必须分开。原文件默认完整保留，进度只反映真实传输，状态最终区分本地保存/等待/已送达/失败。离线设备仍可查本地记录。群组保留，待评估设备组和多设备共享用途。跨网、后台、断点续传、离线队列和历史同步均需单独验收。

## 源码调查（除验证表外均为静态阅读）

| 模块 | 实现与结论 |
| --- | --- |
| UI | `desktop/src/index.html`、`views/sidebar-middle.js`、`chat-panel.js`、`settings-modal.js`；无框架组件，store 驱动重绘；经典 UI 默认，newUI 可选。 |
| 身份 | `identity.js` 初次生成 UUID，存于 SQLite users；username 是可变显示名；历史按 userId/chatId 关联。改名沿用 Identity.update/save/beacon。多账号及向手机导入账号意味着“账号身份”不严格等同“物理设备身份”，后续需独立 deviceId 与迁移方案，不能直接把 userId 宣称为不可复制硬件身份。 |
| 发现/连接 | `network/discovery.js` UDP 45678 / 224.0.0.251；TCP 46000，`socket.js` 及 main.js 自动连接；IP 为路由信息。当前 friends 可能包含发现对象，不是可信设备库。 |
| 加密/信任 | `desktop/e2ee.js`、`shared/crypto` 提供密钥处理；`components/trust.js`/reputation 是举报信誉功能，不是自己的设备配对授权。必须另建配对记录与密钥变更确认。 |
| 消息/历史 | `store.js` + SQLite messages/attachments；已有本地记录、读取/回执相关逻辑。socket 连接期间的 `_pendingMessages` 是内存队列，不能等同持久离线发件箱。尚未证明所有 UI 成功状态均以接收方确认结算。 |
| 文件 | `chat-panel.js` 1.5 MB 以上走分块；`network/transfer.js` 64 KiB 块、最多 3 次块重试、60 秒超时；transfer_state 与 userData/temp 支持部分续传。发送会话恢复和真实断网重启仍需双端测试。 |
| 大小/内存 | settings 默认 maxFileSize=500 MB，桌面搜索只确认设置与编辑项；Android app.js 有发送大小检查，未证实发送/接收路径统一强制限制。renderer Promise.all(file.arrayBuffer())、数据库某些 readFileSync 路径可一次性加载文件，不能宣称恒定内存。 |
| 完整性 | SHA-256 已实现；续传 hash 不匹配会失败，但新传输不匹配仅警告并保存，缺 hash 也可通过。上游单测甚至锁定了该行为。必须修改为失败/隔离并更新测试，不能把跨平台 hash 不同解释为正常。 |
| 原文件/保存 | 已读发送路径使用原始 bytes；JPEG poster、200px WebP thumbnail 是预览。尚未穷举全部移动媒体路径。附件可能为 orbit.db BLOB 或 localPath，临时文件在 userData/temp；不是统一 Downloads 文件夹。需要显式保存目录、打开/定位及缺失路径恢复体验。 |
| 通话 | `components/webrtc-call.js`、`network/webrtc-peers.js`、shared signaling，保持原样。本机 UI 测试不能证明真实双端麦克风/摄像头通话成功。 |
| 跨网 | WebRTC DataChannel + relay/signaling；须配置并验证 relay/STUN/TURN；本轮未部署和跨 NAT 测试。 |
| Android | `mobile/android/.../OrbitForegroundService.java` 有前台服务和 WakeLock，MainActivity 启停服务；存在后台设计不代表被系统杀进程后仍可靠。未构建 APK、未真机验证。 |
| 同步 | shared/network/settings-sync 是白名单外观同步；account-transfer 是账号迁移。均不应当作持续多端历史同步。 |

## 本轮实现

1. 窗口/标题栏和托盘逐步改为 LocalLink，README 说明来源及非官方关系；底层标识保持原样。
2. 主设备列表和连接入口改用 Devices / Connect a device；保留 Groups 与通话功能。
3. 设置 → This Device → Device name：允许 1–32 个 Unicode 字符（包括中文），拒绝空白和控制字符，原 UUID、tag 和历史关联不变；仍走现有广播路径。
4. 会话顶部的 Local device details 可编辑本机备注及手机/台式机/笔记本/平板类型。元数据按本地账号 ID + 对端 ID 存入独立设置项，不进入远端 profile 或广播；类型为本机标记，未知默认不猜测。列表、目录和顶部展示备注，原始名称在详情保留。
5. Echo 显示为 Local demo，避免当作实际联网设备计数。没有删除欢迎消息或旧历史。

## 简化候选清单

| 现有内容 | 下一步建议 |
| --- | --- |
| tutorial-modal.js 首启引导 | 简化为命名、连接、接收权限三步；先改入口和内容，保留实现。 |
| shared/ui/welcome-slides.js | 换为设备连接及保存位置说明；避免影响 Android，设计可配置文案。 |
| app.js Echo welcome sequence / local-echo | 移入帮助/演示入口，旧会话保留；本轮仅标注 demo。 |
| 浅色模式 Flashbang 彩蛋 | 后续默认禁用白闪及玩笑确认框，保留直接主题切换。 |
| Profile Frame、Bio、About Me、头像装饰 | 降为高级个性化选项，不删除代码。 |
| Activity、群组、翻译、举报信誉、账号切换 | 逐项评估；群组不机械重命名，配对与社交信誉不得混用。 |
| 更新与关于页面 | 仍有 Orbit 文案和上游发布入口；正式发行前必须隔离更新来源并审计所有品牌和版权。 |

## LocalSend 可行性

参考 [LocalSend 主项目](https://github.com/localsend/localsend) 和 [协议 v2.2](https://github.com/localsend/protocol)。协议使用 UDP 发现和 HTTP(S) register/prepare-upload/upload，会话及文件 token 授权上传，与 Orbit 自定义 TCP 报文不兼容。可在统一设备目录和传输任务抽象后增加协议适配器，不替换当前网络层，也不复制第二套联系人/UI。对端能力决定选择一种传输，避免重复连接和重复记录。LocalSend 互传仅承诺协议文件/文本能力；聊天历史、通话、配对增强属于 LocalLink 能力。尚未实现互通。

## 许可与依赖

保留上游 LICENSE、版权、图标字体及原始声明。本轮不引入新外部素材。`desktop-direct-dependencies.json` 记录实际安装的直接依赖许可证字段，非完整许可审计。LocalSend 主项目为 Apache-2.0，本轮仅研究协议、没有复制源码。发布前应逐一核实所有间接依赖 NOTICE、字体、音效、图标/截图来源；仓库 MIT 不自动证明每项素材授权。npm ci 报告 24 项依赖漏洞（6 moderate / 16 high / 2 critical），尚未做生产可达性分析和升级，未盲目 audit fix。

## 验证与阶段计划

已实际运行未修改 Orbit：全部根目录 unit 命令通过，Windows Electron 的消息输入、主题、设置持久化共 6 个 E2E 通过。改造后上述 6 项及新增设备命名/备注/重启测试共 7 项通过。测试均使用临时 userData，不操作用户现有历史。截图 `artifacts/phase1-dark.png` 和 `phase1-light.png` 使用测试设备，非真实对端。最终局部修订后重新运行设备测试通过。浅色截图通过实际设置入口切换。

未验证：真实双设备通信与通话、500 MB 文件/峰值内存/断网续传、完整历史回归、原版 LocalSend 互通、Android/macOS/Linux、打包安装及生产安全。

- 阶段 1（本轮）：来源基线、Windows 启动、设备语义和命名、本机备注、测试及调查文档。
- 阶段 2：可信设备/密钥与明确授权接收，完整性失败隔离、送达 ACK 状态、存储目录与真实进度；两台 Windows 互测原文件 hash、断网、拒收、磁盘满。
- 阶段 3：移除 renderer 全量读入，核查大小限制，验证已有续传；独立开发持久发件箱。验收后整理引导和社交入口。
- 阶段 4：统一传输任务抽象后做 LocalSend 适配器，与原版实测；Android 前台/锁屏/后台测试，再决定跨网和持续历史同步范围。
