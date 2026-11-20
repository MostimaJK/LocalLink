# LocalLink 开发说明

调查日期：2026-11-21（Asia/Shanghai）。首阶段目标是 Windows 可运行的小步改造，不发布安装包。

## 产品方向修正（2026-11-21）

以传输工具为产品中心，Orbit 是可复用的实现基础，不再以其聊天产品结构作为最终信息架构。

- 首页展示“附近设备”，自动发现同一局域网中运行兼容客户端的设备；并非扫描后能向任意普通手机/电脑发送文件。
- “收藏设备”是用户主动保存的常用目标，离线时仍保留入口、备注和本地传输记录；附近设备出现/消失不能自动增删收藏。
- 收藏仅表达常用偏好，不等于配对、身份验证或自动接收授权；分别保存收藏、配对信任及接收权限。
- 主操作为选设备、选文件/粘贴内容、发送；传输队列、真实进度、结果和保存位置优先。文字与链接仍是可传输内容。
- 聊天式时间线保留为设备详情中的传输记录；语音视频保留为次级工具。群组后续评估，不作为首页中心。
- 下一轮应拆开 discovery 的临时在线设备、持久收藏与信任记录，复用现有网络与传输能力，重构 UI 和状态流，不能只改 Friends 文案。

以上为产品方向；第二阶段首批已实现附近/收藏/记录分区，以下进展记录界定实际完成范围。

## 来源与运行

- 上游：https://github.com/D4niel-dev/Orbit
- 基准：`a5ced4a95ac0f84b351c475370fe1b6cea1e1101`；完整克隆，523 个历史提交；远端 `upstream`，分支 `locallink/phase-1`。
- 克隆前目录为空，工作目录及已检查的父级没有 AGENTS.md；源码中也未发现该文件。
- MIT `LICENSE` 原样保留，版权为 D4niel-dev & Orbit Team。未发现上游 NOTICE。
- Electron 32、原生 JS/CSS、better-sqlite3、electron-store；Android 为 Capacitor 8 + Java 插件。Windows/macOS/Linux 有 builder 配置；本轮仅 Windows 运行验证。

Windows 日常使用可双击根目录 `Start-LocalLink.bat`，启动位置不依赖当前终端目录。依赖齐全时直接启动；缺少 Electron/SQLite 时自动安装并重建原生模块（首次需要 Node.js、npm 和网络）。失败保留错误窗口。`Start-LocalLink.bat --check` 检查 Electron 和 SQLite ABI，使用内存数据库，不打开主界面。仍使用现有数据目录，不会为每次启动创建新身份。

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


## 第二阶段首批：设备浏览与传输首页（2026-11-21）

已实现：
- 窗口移除启动 maximize，按鼠标所在显示器工作区居中，默认不超过 1200×800 DIP 或工作区 90%；小屏按可用尺寸收缩。仍可手动最大化。
- 附近设备由 Discovery 每次有效 beacon 的独立 IPC 事件驱动，45 秒无新发现过期，5 秒周期清理。它与 Orbit presence（在线/离线）不同，不能仅凭 online 标记进入附近列表。重启不恢复发现状态。
- 收藏是独立的本地设置字段，按本地身份/对端 ID 保存，详情修改会保留收藏字段；不广播、不创建配对/接收授权。原 friends 表保留作兼容的设备资料与历史索引，本轮没有数据库破坏性迁移。
- 记录分区保留已知的非演示设备；离线可打开原记录。取消收藏只改变收藏字段，不删除历史。旧记录没有自动变成收藏。
- 首页换成选择设备传输的入口；Echo 从主设备列表移到本机演示，首启不自动弹出聊天教程，手动教程代码保留。侧栏设备入口可回到传输首页。选择设备后仍使用原文件添加、拖放、粘贴和文字输入路径，未更改其送达语义。
- 主列表搜索在切换分区和新发现时继续生效；星标支持键盘按钮与 aria-pressed 状态。

验证：8 项 Windows Electron E2E 通过（新设备浏览/窗口、命名、消息输入、主题、设置）。新测试验证居中、非最大化/全屏、普通在线历史不进入附近、模拟发现进入附近、发现过期但收藏保留、重启后仅收藏保留、取消收藏不丢记录。发现测试通过 main-process IPC 注入，不代表两台物理设备的 LAN 验收。使用临时数据目录。

设计依据：原先启动强制最大化、全部联系人混在设备列表、欢迎页强调聊天。改为居中可调整窗口、三个独立设备视图及传输导向首页。沿用原有中性背景、主题变量、蓝色操作强调和侧栏宽度，未引入新视觉库。截图 phase2-home.png 为测试设备；phase2-device-dark/light.png 为设备详情。浅深主题实际切换检查通过。

仍待完成：独立物理 deviceId 及旧账号迁移、配对与接收授权、传输任务状态/ACK、严格完整性失败处理、流式内存优化、双设备与 Android 实测。当前产品不能宣称已完成第二阶段全部可靠性工作；首批重点是可用的信息架构和状态分离。LocalSend 互通仍未实现。上游自动建连及接收逻辑没有因此变成可信授权体系。

## 最新范围调整与精简审查

2026-11-21 用户明确：主要复用 Orbit 前端，目标为 LocalLink / LocalSend 互通。此要求取代早期“长期沿用 Orbit 网络体系”的默认方向。具体审查、已删除内容、待清理引用和协议迁移优先级见 [产品精简审查](SIMPLIFICATION-AUDIT.md)。本轮已精简本设备、About、主要头像展示和浅色彩蛋，停止上游更新检查；LocalSend 互通仍未实现。

## 语言设置（2026-11-21）

设置 → 本设备新增 Language / 語言 / 语言：繁體中文（默认）、简体中文、English。保存于独立本机键 locallink.language，不广播或随外观同步。切换即时生效且保留名称草稿；重启恢复选择。显式 UI 语言表与 data-i18n 标记只处理产品文案，不翻译设备名、消息内容、文件名和许可证原文。

当前覆盖主导航、附近/收藏/记录、本设备设置、首页、设备详情基础控件、About 主要说明及主题基础选项；Orbit 遗留高级设置、长篇提示、菜单及部分动态文案仍需逐步迁移，不能宣称全应用翻译完毕。英文/繁简切换及非默认语言跨重启测试通过，另两项设置回归测试通过。

协议说明：Orbit 是 UDP 发现 + 自定义 TCP JSON 帧（4 字节长度前缀）的应用协议，配合自定义消息/分块及 WebRTC 增强功能。LocalSend v2.2 使用 UDP/HTTP 发现和 HTTP(S) 文件会话接口，适用于基本传输，应以适配层替换 Orbit 基本传输路径；通话不属于 LocalSend 互通能力。参考 https://github.com/localsend/protocol 。本次没有替换网络实现。

## LocalSend 协议预览版

此前“尚未实现协议”的描述记录的是早期状态。现已实现 HTTPS 文件收发适配器并设为默认，仅启动一个网络层；旧通信/通话可在网络 → 高级连接选项选 Orbit legacy 后重启使用。实现范围、测试证据与限制见 [协议预览说明](LOCALSEND-PREVIEW.md)。原版客户端双机互测尚未完成。


## 恢复文件会话与设置视觉（2026-11-21）

用户要求保留 Orbit 原有视觉完成度，以聊天时间线呈现设备间文件传输；传输工具定位不等于放弃会话式交互。详情和截图见 [本轮设计记录](CONVERSATION-REFINEMENT.md)。

- 恢复紧凑设备顶栏、左右收发文件气泡、日期/时间、固定底部选文件操作；仅更改呈现，不退回 Orbit 传输协议。
- 发送任务从准备时创建，等待、传输、送达、失败更新同一 ID；按 startedAt 排列，避免完成时间改变发送顺序。旧记录保留并以原 time 排序。重启将未完成的发送标记为中断，不宣称离线自动排队。
- 本设备恢复分组卡片，语言单语言标签；保留设备名草稿和稳定身份。网络配置移至网络页；关于页突出 LocalLink，完整上游 MIT 许可收纳于开源许可详情，仓库 LICENSE 保留。
- 修复桌面内容网格高度重复计入标题栏，使底部按钮保持在窗口内。
- 仍不支持新协议的纯文字/链接输入、拖放、粘贴、图片缩略图和精确字节进度；接收仍在完成后生成持久卡片，接收过程和接收失败卡片后续补齐。未改 Android。

## 设置与窗口控件（2026-11-21）

本轮按用户要求移除设置折叠分组与关于页来源块，沿用主题重新实现圆角下拉菜单、右上角关闭按钮和细线窗口控制。参考本地 Memivo 的 Spectrum 2 视觉交互，未移植其框架或源代码。保留源码许可，并明确配置随安装包携带。详见 [界面细化记录](CONVERSATION-REFINEMENT.md)。
