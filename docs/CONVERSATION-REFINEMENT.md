# 文件会话与设置修正

2026-11-21。目标为 Windows Electron。采用现有 Orbit 布局和主题；不引入另一套视觉库。

## 问题与决策

- LocalSend 原面板只有标题、按钮和反序列表，丢失用户要求的会话形式。改为 72px 设备栏、按开始时间正序排列的文件气泡、固定底栏。左为接收、右为发送；颜色仅辅助区分，文本明确标注。
- 之前的设置将协议和三语文案堆在设备名前。恢复 Orbit 的标题/卡片/输入框样式，仅设备名和语言作为日常设置；协议位于网络页的折叠高级选项。
- 之前关于页的大段上游来源说明压过了产品身份。以 LocalLink 名称、用途和版本为主体；复用源码的完整 MIT 声明放在默认折叠的开源许可内。LICENSE 未修改；许可保留不构成将新增原创内容转让给上游。
- 桌面网格 100vh 行高叠加标题栏 padding，导致底栏裁切。改为剩余可用高度的网格行；移动端媒体规则未修改。

视觉约束：原中性深浅底色、现有蓝色强调、Lucide 图标、Outfit/DM Sans 字体及主题变量。文件名 14px、元数据 11–12px、设备名 16px；状态明确，路径按需展开，无装饰头像和社交设定。
参考：用户提供的 Orbit 原布局与本轮截图（会话、设置和关于）；uiux-product-designer 的桌面工作区和表单样式规则。不额外套用其他产品模板。

## 行为

发送 preparing → awaiting → transferring → delivered/failed 使用同一任务 ID，数据库更新原记录。到达时间不改变发送顺序。旧数据没有 startedAt，无法事后重建开始时间，保留原 time。重启把未结束发送标成失败/中断。

刷新时保留浏览旧记录的滚动位置和已展开路径；接近底部才跟随新记录。切换设备后，原设备发送回调不会强行抢回会话。离线可看记录、打开已存在的文件；文件不存在显示错误。收发成功才提供打开动作。

## 验证证据

- Windows Electron E2E：文件顺序与左右方向、等待/失败状态、路径展开及滚动保持、离线记录、文件缺失错误、底栏可见。
- 设置 E2E：默认繁体、繁简英切换、未保存名称草稿保留、协议持久化、关于页折叠许可与 LICENSE 全文一致、1000×680 DIP 窗口控件可见。
- 原设备命名/备注/重启用例及语言跨重启用例回归。
- 两个本机 HTTPS 实例实际传输 2 MiB+1 byte 随机文件，逐字节一致；拒收、错误 token、哈希和 TLS 指纹拒绝；发送状态序列和稳定 ID 验证。

截图（文件卡片为测试夹具，不代表原版客户端互测）：
- ../artifacts/conversation-dark.png
- ../artifacts/conversation-light.png
- ../artifacts/conversation-empty.png
- ../artifacts/settings-device-refined.png
- ../artifacts/about-locallink-refined.png

限制：当前底栏只支持原生单文件选择。文字、拖放、粘贴、图片预览、接收中/失败持久卡片、精确百分比、取消/续传仍待实现。部分旧版设置和原生传输提示仍未完整本地化。未验证原版 LocalSend 双机收发与 Android。无数据迁移、无商标权属确认、未改变项目许可策略。

本轮结果：4 个相关 Electron E2E 用例通过（文件会话、设置与许可、设备命名/备注跨重启、语言跨重启）；协议测试及 Start-LocalLink.bat --check 通过。滚动断言允许 Windows DPI 的不足 1px 舍入；浅色截图等待主题过渡结束。发送完成不抢回其他会话已使用可控 IPC 响应验证。截图为本机 Electron 实际渲染，文件条目为测试数据。

## 设置与窗口控件细化（2026-11-21）

按用户后续要求：
- 常用设置、关于页去掉 Orbit 产品文案；旧协议在界面中称为“旧版连接（支持通话）”。代码标识和数据目录不变。完整上游 LICENSE 留在仓库，并在 electron-builder 中明确随包复制到 resources/licenses/Orbit-LICENSE.txt；安装包尚未重新构建，不能把配置验证称为打包验证。
- 设置保留的分组全部直接展示，移除折叠行为和箭头；协议选项直接可见。删除设备名、语言等重复提示，关于页不再放许可折叠块。成功文件卡片直接显示路径。
- 实际查看本地 D:/Python_Project/Codex/Memivo/frontend/src/main.tsx 与 frontend/package.json，以及技能随附的 Memivo 语言菜单截图。参考其 Spectrum 2 Picker 的圆角浮层、轻选中底色和勾选标记，按现有 vanilla JS/主题实现共享菜单；未复制 Memivo GPL 源码或引入 React/Spectrum 依赖。
- 所有设置 native select 和设备类型选择使用共享菜单；保留原值与 change 事件。支持箭头/Home/End/输入搜索、Enter/Space 提交、Escape/Tab/外部点击关闭、视口避让，原生 dialog 内菜单保持在其模态子树。
- 设置和设备详情添加右上角叉号；设置关闭后保留当前会话中的名称草稿并恢复触发按钮焦点。内容滚动不移动关闭按钮。
- 主窗口 36px 标题栏，46px 点击区域、12px 细线图标。最大化/还原图标同步实际窗口事件。关闭保持收起到托盘。

验证：6 个相关 Windows Electron E2E 用例通过（新增菜单/弹窗及窗口控制两项，原有语言持久化、设备身份/备注、文件会话、设置四项）。实际检查深浅色截图、小窗口菜单边界、键盘选择、不保存导航中的候选值、焦点恢复、名称草稿、协议持久化、设置直接展示、最大化/还原/最小化/关闭。首次设备详情菜单被原生 dialog 拦截，修复模态子树后该用例通过。未做读屏器和移动端验证。

截图：settings-menu-dark.png、settings-menu-light.png、window-chrome-refined.png、device-details-refined.png（均在 artifacts/ 下）。前文关于路径及许可折叠的说明是上一版行为，以本节为准。


2026-11-21 后续：文件卡片已新增输入、进度与操作，重复绝对路径移到接收目录设置和“所在目录”操作，详细当前行为见 [第二轮交付](IMPLEMENTATION-ROUND-2.md)。语言切换重建侧栏后，设置关闭会按触发控件 ID 恢复焦点。
