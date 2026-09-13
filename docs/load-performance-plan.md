# md-view 文件访问与桌面开发说明

## 当前目标与授权

- 用户已明确授权完整实施桌面重构和 GitHub Pages 产品介绍页；轻量多标签，在线编辑器保留在 `/md-view/play/`。
- 仅修改 `D:/Projects/md-view`；不使用 Computer Use、多代理或视频生成。实际观感由用户验收。最新授权（2026-09-12）：检查逻辑、升级版本、本地构建并提交推送远端。
- 起点 `main` / `243dff9`，2026-09-12 复核工作区干净。已提醒大改前留档。

## 已确定的实现

- 单文件打开零递归扫描；目录惰性分批加载；显式启动、有预算、可取消的工作区文件/标题索引。
- Rust 阻塞工作移入工作线程；统一忽略规则、非递归监听、文档版本与安全保存。
- 多标签独立文档状态、编辑历史和位置；基础文件操作、自动草稿、关闭确认，自动写回默认关闭。
- 静态中英产品页独立构建；在线体验修复内容同步；Pages 主分支部署，PR 只验证。

## 进度与验证

- [x] 只读检查当前打开/扫描/保存/UI/Pages 链路；确认同步递归标题索引导致阻塞风险。
- [x] 检查 Git 状态与本机 Node/Rust 工具入口。
- [x] 后端文档/扫描/监听/草稿接口；17 项 Rust 常规测试通过，十万文件与 Windows 回收/恢复专项通过。
- [x] 前端会话、目录、搜索状态与轻量多标签 UI；39 项状态/体验/渲染与 CodeMirror 历史测试通过，前端检查零错误零警告。
- [x] 静态中英文产品页、在线体验与构建工作流；Pages 组装构建及路由/资源检查通过。
- [x] Lite/Plus/Web 构建、Rust check/test/Clippy、路由验证及依赖校验。
- [x] 最终差异核对、Rust 格式与 `git diff --check` 通过；`1.1.0` 本地构建工作完成，按最新授权提交推送。

### 最近检查点（2026-09-12）

- 单文件专项：110,604 字节 Markdown，旁边 100,000 个无关文件；目录枚举 0、无关文档读取 0。普通/大型目录后端 p50 为 1.278/1.283 ms，p95 为 1.622/1.718 ms，各 30 次。仅后端读取/解码，不代表 WebView 首屏。
- 大 Markdown 专项：2,234,418 字节，默认源码；JSDOM 中快速/完整 Plus 渲染为 8/2,487 ms，排除磁盘与扫描。现有语法样例的公式、两幅 Mermaid SVG、表格、链接通过。
- 新修复：搜索异步等待不占阻塞线程；重命名/保存互斥、关闭期间新编辑保护；Windows 目录缓存键统一；跨文档锚点、中文路径解码；扫描访问错误单独反馈。
- 原生对话框按 Tauri 自定义按钮文字处理，未知返回值一律取消。Windows 使用专用回收接口，拦截永久删除通知；仅对项目内测试文件执行了回收/恢复，测试后已清理。
- 测试覆盖：浅层目录、忽略规则、Unity 识别、junction 循环、进行中的取消、扫描预算、标题缓存命中/失效、编码与磁盘冲突；标签去重、异步打开/保存/关闭、草稿恢复/迁移、真实 CodeMirror 撤销与光标、在线源码导出及现有语法样例。
- 原始性能结果：`.local/open-performance.json`、`.local/render-performance.json`。测试数据已由测试清理，`.local/fixtures/` 保留作为专用测试父目录。

## 路径与保留项

- 保留现有 Lite/Plus 渲染能力、主题、草稿读取兼容性及公开 Release 身份。
- 用户最新要求已授权提交和推送 `origin/main`，会触发现有 Pages 部署与桌面 CI；不额外打标签或公开桌面 Release。源版本统一为 `1.1.0`；官网仍按现有公开产物宣传。

### 推送前逻辑复核（2026-09-12）

- 已核对工作区：改动与本任务重构记录一致，包括需保留的未跟踪源码、测试及官网文件。提交前保留全部这些文件，不加入本地产物和依赖。
- 已修复并加入回归覆盖：取消旧目录请求不再阻塞新请求建立；磁盘版本/重载响应需同时匹配标签路径、磁盘版本和编辑版本；已删除原文件可以重新保存；移动与另存为互斥；旧路径的读取与草稿恢复不会影响另存为或重命名后的标签。
- 同时修复：文件栏更多菜单被冒泡点击立即关闭；HTML 导出在打开保存对话框前固定文档快照；根目录子路径不再生成双斜线；文件操作会取消旧搜索；新建文件不抢占后来选择的标签；Tauri 构建配置位于 Cargo 参数分隔符之前。
- 新增 9 项前端竞态回归；完整结果 39 通过、1 性能专项跳过。Rust 常规 17 通过、2 已执行过的昂贵/回收专项跳过。本轮不重复创建十万文件。前端类型、Rust check/Clippy/fmt、版本一致性和 Pages 路由/资源检查全部通过。
- 构建：Lite/Plus 均生成 `1.1.0` Windows x64 便携 exe；Pages 首页、英文页和 `/play/` 组装完成。仅修改应用版本，没有安装或升级依赖。远端基线仍为 `243dff9`；Git 网络查询使用本次命令的 `http.version=HTTP/1.1` 重试成功，没有更改持久网络配置。
- 推送策略：单次正常提交到 `origin/main`，不强推、不打标签；远端验收以该提交的 Build / Pages Actions 为准。本地产物、构建日志和验证记录保留在 `release/` 与 `.local/`，均不入库。

## 模块与不变量

| 模块 | 职责 |
| --- | --- |
| `src/state/documents.ts` | 稳定标签 ID、内容/保存版本、编码、磁盘版本、编辑器状态、阅读位置与可视化历史 |
| `src/state/desktop.ts` | 文档、草稿、原生对话框和文件操作的协调；异步结果及保存版本保护 |
| `src/state/workspace.ts` / `search.ts` | 惰性目录缓存、可见行及显式搜索任务；拒绝旧请求结果 |
| `src/state/drafts.ts` / `preferences.ts` | 每个草稿键的写入队列、设置与最近路径；不清空旧草稿 |
| `src/AppShell.svelte` / `src/components/` | 组合工具栏、标签、虚拟文件列表、正文、大纲和设置；仅挂载活动文档编辑器 |
| `src-tauri/src/documents.rs` | 单文件读取、安全保存、版本检测、原生文件操作；磁盘操作在 `spawn_blocking` |
| `src-tauri/src/workspace.rs` | 统一目录规则、分批枚举、预算/取消、标题缓存、非递归监听 |
| `src-tauri/src/drafts.rs` / `links.rs` | 旧草稿兼容、原子草稿写入、实际引用的链接校验与缓存 |
| `src-tauri/src/recycle.rs` | Windows 回收站保护，非 Windows 使用 trash；失败不退化为永久删除 |

1. `openFile` 不调用目录/索引接口，不推断父目录为工作区。自动化测试持续约束这一点。
2. 目录直接子项每批 128 条，前端只渲染可见行。忽略 `.git/.svn/.hg/node_modules/target/dist/.svelte-kit`，支持 `.gitignore/.ignore` 与用户模式；仅 Unity 项目排除 `Library/Temp/Obj/Logs`。不跟随符号链接或 junction。
3. 文件名/Plus 标题搜索由独立按钮启动。搜索等待异步锁，阻塞线程池同时最多处理一个递归扫描；打开、保存不等待这把锁。预算为十万条目/30 秒/十万结果，超过 2 MiB 的文档不建标题索引。
4. `request_id` 贯穿 Channel 消息及前端状态；取消既设置后端标记，也清除前端当前 ID。更换工作区与文件操作后失效旧结果。
5. 标题缓存使用路径、mtime、size，最多 512 个文档，每文档最多 2,048 个标题。链接校验去重，仅读取实际引用的目标，锚点缓存最多 128 个目标。
6. `notify::RecursiveMode::NonRecursive` 只监听当前展开范围和已打开文件的父目录。事件合并 300 ms 后局部刷新；焦点恢复与手动刷新复核相同范围。
7. 保存提交固定内容/版本；保存期间的新编辑不被标记为已保存。保存冲突需要明确选择，重名不静默覆盖，跨盘移动提示另存为。Windows 配置 `FOFX_RECYCLEONDELETE` 和提前失败，通过 `PreDeleteItem` 拦截没有回收标志的删除；参考 [Microsoft 操作标志](https://learn.microsoft.com/windows/win32/api/shobjidl_core/nf-shobjidl_core-ifileoperation-setoperationflags) 和 [删除前回调](https://learn.microsoft.com/windows/win32/api/shobjidl_core/nf-shobjidl_core-ifileoperationprogresssink-predeleteitem)。
8. 已支持编码为 UTF-8、GBK、UTF-16LE/BE，保留 BOM 与 LF/CRLF/CR 风格，新文档 UTF-8 无 BOM。编码不可表示字符时允许选择转换 UTF-8。
9. 默认 900 ms 自动保存草稿，原文件写回独立设置默认关闭。源编辑器完整 `EditorState` 保留撤销与选区；切换文档/视图时保存滚动位置。
10. 大于 2 MiB 的文档默认源码。快速预览与延迟完整渲染继续保留，位置/大纲查询复用块缓存。完整渲染仍会占用主线程，用户应按需开启。

## IPC 与 Pages

| 接口 | 返回或消息 |
| --- | --- |
| `document_open` | `DocumentFile`：稳定路径 ID、内容、编码/BOM/换行、mtime/size/hash 版本，无目录树 |
| `directory_load` | Channel `DirectoryBatch`：请求 ID、目录路径/版本、分批条目、访问错误、完成标记 |
| `workspace_scan` / `scan_cancel` | Channel `ScanBatch`：请求 ID、文件或标题、进度、跳过项/错误、取消/完成/不完整标记 |
| `document_save` | 实际文件路径/新磁盘版本，或 `conflict` / `encoding` 结构化结果 |
| `move_path` / `create_folder` / `trash_path` | 实际路径或错误；成功后协调标签、草稿、最近路径和目录缓存 |
| `workspace_watch` / `document_versions` | 监听可用性与失败路径；打开文件版本变化 |

`site/content.mjs` 维护中英产品文案，`site/template.mjs` 输出静态 HTML。默认纸色与森林绿和桌面新默认主题一致，旧主题选择继续保留。官网首屏有下载、在线体验和 GitHub；移动端、键盘焦点、减少动画、分享元信息及站点图已包含。

`build:web` 顺序生成 `dist-site/` 和 `dist-play/`，再组装 `dist-site/play/`；桌面产物继续为 `dist/`。默认 `VITE_BASE_PATH=/md-view/`。`check:web` 检查三个入口与本地资源、元数据和首页隔离，另以本地 HTTP 请求确认首页、中英切换、`/play/` 及刷新返回 200。Pages PR 仅构建；部署仅发生在 `main` 更新或手动运行 `main` 时。

官网只描述现有公开 Release 能力，目前下载为 Windows x64 便携版与 macOS Apple Silicon DMG。重构功能要在对应版本正式发布后再加入正式宣传文案。

## 验证命令与本机依赖

日常门禁：`npm run check`、`npm test`、`npm run check:editions`、`npm run build:lite`、`npm run build:plus`、`npm run build:web`、`npm run check:web`，以及 `cargo check/test/clippy --manifest-path src-tauri/Cargo.toml --locked`（测试与 Clippy 使用 `--lib`，Clippy 附加 `-- -D warnings`）。`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` 检查 Rust 格式。

专项不加入普通 CI，以免重复创建大量文件：

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked large_project_open_has_zero_directory_visits -- --ignored --nocapture
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked recycles_and_restores_own_fixture -- --ignored --nocapture
$env:MD_VIEW_BENCHMARK = '1'
npm.cmd test -- tests/markdown-regression.test.ts
Remove-Item Env:MD_VIEW_BENCHMARK
```

工具环境：Windows x64，Node 24.19.0，npm 11.17.0，Rust/Cargo 1.96.0。Rust 最低版本声明同步为锁文件依赖所需的 1.88。npm 使用 `https://registry.npmmirror.com/`；没有修改系统级 npm 配置。

| 安装范围 | 路径 | 大小 / 校验 |
| --- | --- | --- |
| 项目 npm 依赖 | `D:/Projects/md-view/node_modules` | 324,367,927 字节（含原有依赖和测试缓存） |
| 项目 npm 缓存 | `D:/Projects/md-view/.npm-cache` | 212,546,371 字节；485 项 / 211,989,964 字节内容校验通过 |
| 新增 Rust 依赖源码 | `C:/Users/Ferris/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/` | 28 个新锁定包，142,077,174 字节；对应 `.crate` 全部 SHA-256 匹配 Cargo.lock |

新增直接依赖：`ignore=0.4.33`、`notify=8.2.0`、`trash=5.2.8`；安全写入/版本检测依赖锁定为 `tempfile 3.27.0`、`blake3 1.8.7`，平台使用 `windows-sys 0.61.2` / `libc`；Windows 回收保护复用已锁定的 `windows 0.61.3` / `windows-core 0.61.2`。新增开发工具：Vitest 4.0.18、JSDOM 29.1.1、Prettier 3.8.1、prettier-plugin-svelte 3.4.1。

- 初始 `1.0.1` 的 `package-lock.json` SHA-256：`23089a0c81183ddc0d63f36d249da01d45ad816447e740d25781df954f388592`
- 初始 `1.0.1` 的 `src-tauri/Cargo.lock` SHA-256：`1a412903b4314945b2bd5adea30ebc9cff645c650074c5b35c57ca8ff23d3166`
- 逐包路径、大小和校验：`.local/dependencies.json`。构建/测试数据仅在 `.local/`、`dist/`、`dist-play/`、`dist-site/`、`src-tauri/target/`，均不加入 Git。

## 实际设备验收

### Windows 1.1.0 构建与校验（2026-09-12）

- 命令：`npm.cmd run tauri:build:lite -- --no-bundle --ci -- --locked --offline`，随后以同样参数运行 `tauri:build:plus`。Release 优化编译分别为 54.66 / 53.70 秒。
- `release/md-view-lite_1.1.0_windows-x64-portable.exe`：4,294,656 字节；SHA-256 `ecc6b0086b4f8ebb1036e44368f10c5cec4f3249131a82d3a4adbbb3e2b552c7`。
- `release/md-view-plus_1.1.0_windows-x64-portable.exe`：6,175,232 字节；SHA-256 `c502046cb7cb9a54f676c255c218a678ce3672dee8f9329b4777df4de51b1450`。
- 两个文件均为 AMD64 / PE32+；Windows 产品名分别为 `md-view Lite` / `md-view Plus`，产品版本 `1.1.0`，与对应编译输出逐字节一致。保留此前的 `1.0.1` 验收 exe。
- `1.1.0` 锁文件 SHA-256：npm `8cae8cd2fa968c60102eff0b7665ba2af6a5bb33042c21dd71f4d0aefeb6f8d2`；Cargo `4b430d91ce8fa459cfad61d227aac1e22f7a4d87732dc537837929b5a9f2c23f`。与旧锁相比仅应用自身版本改变。
- 日志：`.local/review-*.log`、`.local/package-lite-1.1.0.log`、`.local/package-plus-1.1.0.log`。本轮未运行桌面应用，实际窗口观感继续由用户验收。

### Windows 本地打包（2026-09-12）

- 用户已要求本地 exe 用于验收，按项目默认选择 Plus 便携版；仅生成本地文件，不运行应用、不提交、不发布。
- 命令：先设 `$env:CARGO_NET_OFFLINE='true'`，再运行 `npm.cmd run tauri:build:plus -- --no-bundle --ci`；复用锁文件中的本机依赖。
- 沙箱内 Vite 子进程创建出现 `spawn EPERM`；本地打包权限重试已通过，Plus 前端与 Rust Release 均构建成功，Rust 优化编译耗时 1 分 25 秒。
- 产物 `release/md-view-plus_1.0.1_windows-x64-portable.exe`：6,174,720 字节（约 5.9 MiB）；PE 头确认 AMD64 / PE32+，产品名 `md-view Plus`，文件及产品版本均为 `1.0.1`。这是尚未发布的本地重构验收版。
- SHA-256：`29ae2fe544de917dddf72a3f1e60b39f6f89fa758d98e84d9523334d65490400`；与 `src-tauri/target/release/md-view.exe` 完全一致。两份依赖锁文件校验值与上述记录一致，打包未改动锁文件。
- 打包日志 `.local/package-plus.log`；exe 已生成，等待用户实际运行验收。

本机自动检查不代替桌面观感验收；没有使用 Computer Use。用户需实际验收拖拽、系统定位、窗口关闭对话框、主题/缩放/侧栏、原生监听及 macOS 运行。Windows 回收/恢复已用专用测试文件验证。JSDOM 的 Mermaid 测试验证实际解析与 SVG 生成，SVG 排版由模拟尺寸支持，不代表真实 WebView 布局。现有编辑器/Plus 图表依赖仍有超过 500 kB 的懒加载分块提示；介绍页不包含这些依赖。API 同时被桌面静态导入和 runtime 动态导入的构建提示不影响功能。
