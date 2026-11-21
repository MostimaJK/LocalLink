# LocalLink 1.0.4

- Windows 11 普通窗口现在使用系统原生圆角。
- 应用内更新使用 Electron 网络栈，支持系统代理。先获取官方校验清单，再下载并同步计算 SHA-256；网络错误和校验错误分别显示。
- Windows 安装版用户可退出旧版后将 Setup 安装到原目录；便携版用户可退出后替换原便携程序。此版本不要求迁移用户数据。

Windows 提供 x64 安装版和便携版。macOS 提供 Apple Silicon 和 Intel 两种 DMG。Windows 安装包未签名，Mac 应用使用临时签名且未经 Apple 公证。发布附件包含 SHA256SUMS.txt。
