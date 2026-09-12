# md-view

[English](README.en.md)

md-view 是一个本地 Markdown 阅读和编辑器，使用 Tauri 2 + Svelte + Vite 构建。它面向需要轻量、本地、可继续自行修改的 Markdown 工具用户。

[产品介绍](https://t-meow.github.io/md-view/) · [在线体验](https://t-meow.github.io/md-view/play/) · [公开下载](https://github.com/T-meow/md-view/releases/latest)

## 当前开发版

本分支包含尚未发布的桌面重构；公开下载的功能与平台以 Release 为准。

- 单独打开文件只读取目标文档。显式打开文件夹后按层加载，展开时读取子项；大型列表只渲染可见行。
- 多标签保留内容、源码撤销历史、视图和阅读位置。`Ctrl+P` 优先查找已打开、最近及已加载文件，工作区索引由按钮按需启动。
- 新建文件/文件夹、另存为、重命名、移动、移入回收站、复制路径及系统定位；基础文件管理由 Lite/Plus 共用。
- 手动保存与自动草稿；自动写回默认关闭。保存使用版本快照、冲突检查和原子替换，保留 UTF-8/GBK/UTF-16、BOM 与换行风格。
- 默认不遍历链接和 junction，遵循 `.gitignore`、`.ignore` 与自定义排除。扫描限额十万项/30 秒；大于 2 MiB 的文档默认源码模式。

快捷键：`Ctrl+N` 新建，`Ctrl+O` 打开，`Ctrl+P` 快速打开，`Ctrl+S` 保存，`Ctrl+Shift+S` 另存为，`Ctrl+W` 关闭，`Ctrl+Tab` / `Ctrl+Shift+Tab` 切换标签。macOS 可使用 Command 对应组合。

架构、接口、验收结果和后续开发约束见 [开发记录](docs/load-performance-plan.md)。

## 项目特点

- 轻量化：使用系统 WebView，Lite 保持基础渲染；下载体积以对应 Release 产物为准。
- 软件体积小：适合直接下载、打包、复制和本地使用。
- 大纲目录：自动提取标题，支持快速跳转。
- 多种视图：支持阅读、源码编辑、可视化编辑和分屏预览。
- 外观美化：内置多套主题，支持给阅读区设置背景图。
- 本地优先：打开本地 `.md` / `.markdown` 文件或目录，不依赖云服务。

![md-view preview](./assets/preview.png)

## 功能

- 打开本地 Markdown 文件或文件夹
- 文件树浏览
- 源码编辑、阅读预览、可视化编辑、分屏预览
- 标题大纲跳转
- 草稿保存
- 保存冲突检测
- 支持 `.md` 和 `.markdown`
- 支持主题切换和阅读区背景图
- 支持 Windows 默认应用设置入口

## Edition 开发策略

md-view 现在按 Lite / Plus 两个 edition 维护：

- `main` 维护共用桌面界面和文件能力，Plus 是高级渲染的开发基准。
- Lite 与 Plus 共用会话、文件管理、草稿、目录浏览和文件名搜索。工作区标题索引、高级渲染、HTML 导出与高级阅读设置属于 Plus。
- 默认开发和打包命令指向 Plus。需要构建 Lite 时使用显式的 `:*:lite` 命令。

## 本地开发

需要先安装：

- Node.js 24 LTS（CI 使用 24）
- Rust stable，至少 1.88（与锁文件依赖的最低要求一致）
- 系统对应的 Tauri 桌面依赖

运行：

```bash
npm ci --registry=https://registry.npmmirror.com/
npm run tauri:dev
```

默认 `npm run tauri:dev` 启动 Plus。Lite 开发使用：

```bash
npm run tauri:dev:lite
```

## 本地打包

```bash
npm install
npm run tauri:build
```

默认 `npm run tauri:build` 打包 Plus。常用 edition 命令：

```bash
npm run tauri:build:plus
npm run tauri:build:lite
npm run tauri:build:both
```

打包产物在：

```text
src-tauri/target/release/bundle/
```

Edition 构建脚本还会把规范化命名的安装包和 portable exe 复制到根目录 `release/`，供本地分发和 CI 上传使用。

当前配置会生成当前系统支持的包：

- Windows: NSIS installer
- macOS: DMG
- Linux: AppImage, DEB, RPM

这些是构建能力，不表示每个公开 Release 都提供全部平台。当前公开 `v1.0.1` 提供 Windows x64 便携版和 macOS Apple Silicon DMG。

Windows 本地默认使用 NSIS，避免 `all` 目标额外下载 WiX。需要尝试当前系统全部 bundle 目标时运行：

```bash
npm run tauri:build:all
```

## 产品页与在线体验

`site/` 为不加载编辑器的独立中英文介绍页；Svelte 在线体验位于 `/md-view/play/`。

```bash
npm run build:web
npm run check:web
```

桌面前端写入 `dist/`，在线体验中间产物为 `dist-play/`，完整 Pages 产物为 `dist-site/`。默认路径前缀为 `/md-view/`，可通过 `VITE_BASE_PATH` 设置。介绍页与体验页一起部署；首页文案只描述已公开发布的功能。

## 开发检查

```bash
npm run check
npm test
npm run check:editions
npm run build:lite
npm run build:plus
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

## Linux 依赖

Ubuntu/Debian 通常需要先安装：

```bash
sudo apt-get update
sudo apt-get install -y build-essential curl wget file libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf rpm
```

其他发行版按 Tauri 2 的 Linux 依赖安装对应包。

## macOS 提示

本项目默认不做 Apple 签名和公证。朋友之间直接打包分发时，macOS 可能会因为 Gatekeeper 拦截未签名应用。正式公开分发前再补开发者证书、签名和公证流程。

## GitHub Actions

`.github/workflows/pages.yml` 对 `main` 的 PR 构建官网与体验页并检查路由；仅 `main` 更新或手动触发时部署 Pages。

桌面工作流 `.github/workflows/build.yml`：

- push 到 `plus` / `main` / `master` 时构建 Windows 和 macOS
- pull request 到 `plus` / `main` / `master` 时运行构建检查
- 构建矩阵覆盖 Lite / Plus 两个 edition，并在上传产物名里包含 edition 和版本号
- 手动运行 workflow 时构建 Windows 和 macOS
- 推送 `v*` tag 时会创建草稿 Release 并上传构建产物

示例：

```bash
git tag v0.2.4
git push origin v0.2.4
```

## 贡献说明

本项目不接受 PR。你可以 fork 本仓库，然后使用 AI agent 或本地编辑器按自己的需求修改、打包和分发。

## 许可证和免责声明

许可证使用 WTFPL v2。简单说：想怎么用就怎么用。

免责声明：本项目按原样提供，不提供任何明示或暗示担保。作者不保证它适合任何特定用途，也不对使用、修改、打包、分发或运行本项目造成的任何问题、损失或责任负责。使用者自行承担全部风险。
