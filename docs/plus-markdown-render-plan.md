# Plus Markdown 全语法显示计划

## 目标

让 Plus 版预览优先覆盖常见 Markdown 文档的显示需求：CommonMark、GFM、Frontmatter、数学公式、Mermaid、代码高亮、本地图片和链接、基础 HTML，以及常见扩展块的稳定显示。

## 范围

- 保留 Lite 版轻量渲染路径，不把 Plus 依赖引入 Lite。
- Plus 预览继续使用 `unified` / `remark` / `rehype` 管线。
- 补齐显示层：任务列表、脚注、定义列表、键盘标签、上下标、标记文本、折叠块、宽表格、Mermaid 错误提示。
- 补充样例文档，作为人工回归测试入口。

## 非目标

- 不在第一步实现 WYSIWYG 对所有扩展语法的可视化编辑。
- 不支持执行脚本、远程插件、外部动态图表运行时代码。
- 不为了极少数 Markdown 方言引入重量很大的渲染框架。

## 实施阶段

1. 增强 Plus renderer：在现有 GFM、数学、Frontmatter、Mermaid 基础上加入轻量扩展语法转换和更清晰的 Mermaid 失败显示。
2. 增强安全清洗白名单：允许必要的 `id`、`class`、`aria-*`、`checked`、`disabled` 等显示属性，同时继续阻断脚本类风险。
3. 增强 CSS：为脚注、任务列表、定义列表、代码块、表格、HTML 语义标签、Mermaid 图提供稳定显示样式。
4. 增加 Plus Markdown 样例：覆盖主要语法，便于后续打开文件手工检查。
5. 运行 `npm run check` 和 `npm run build:plus`。

## 受影响文件

- `src/markdown/renderers/plus.ts`
- `src/markdown/renderers/shared.ts`
- `src/app.css`
- `docs/plus-markdown-syntax-sample.md`

## 兼容与风险

- Lite 版渲染不改动，避免增大默认包体。
- HTML 会经过 DOMPurify 清洗，不允许脚本执行。
- 定义列表、上下标、键盘标签、标记文本采用常见方言的轻量转换，优先显示正确，不承诺完全等价所有编辑器。
- Mermaid 失败时保留原始源码并显示错误摘要，避免文档空白。

## 验证计划

- `npm run check`
- `npm run build:plus`
- 使用 `docs/plus-markdown-syntax-sample.md` 打开 Plus 版预览，检查所有块显示。

## Mermaid 空框修复（2026-09-12）

- 目标与授权：用户要求修复截图中的 Mermaid 渲染问题，并进一步明确授权提交 GitHub、重新构建远端；提交范围为本修复的源码、回归测试与记录，目标 `T-meow/md-view` 的 `main`。单助手，不使用 Computer Use。
- 已确认原因：最终 DOMPurify 清洗删除 `foreignObject` 及其文字；自定义 URI 正则中的 `.-:` 被解析成字符范围，误删 SVG 路径的 `d` 属性。
- 决定：Mermaid 使用 SVG 文字标签，修正 URI 正则的连字符转义；保留现有 HTML 清洗约束。
- 起点：Git 工作区干净；保留现有依赖、锁文件和用户文档。
- 进度：新增两项回归在旧实现上均按预期失败（九个空标签、路径数据被删）；修复后全部前端测试 41 通过、1 个既有性能专项跳过。九个中文标签、十一条连线及箭头数据均保留，SVG 路径与相对链接正常，脚本、事件属性和危险链接继续被清洗。
- 验证：`npm.cmd run check` 零错误零警告；`npm.cmd run check:editions`、Lite/Plus 前端构建及 `git diff --check` 通过。复查仅修改两处渲染配置、回归测试和本记录，未安装依赖或改动锁文件。
- 本地打包：`npm.cmd run tauri -- build --config src-tauri/tauri.plus.conf.json --no-bundle --ci -- --locked --offline`；Rust Release 构建成功，耗时 54.22 秒。测试和构建的子进程在沙箱内受阻后，通过本地验证权限重试完成。
- 修复版：`release/md-view-plus_1.1.0_windows-x64-portable-render-fix.exe`，6,175,232 字节；Windows AMD64，产品名 `md-view Plus`，版本 `1.1.0`；SHA-256 `fef6adf08b36745a280cd14574b53160a1a85833760d3c96e0c1b4cd71274325`，与本轮 `src-tauri/target/release/md-view.exe` 一致。原有 `release/` 便携 exe 保留。
- 验证限制：JSDOM 的 SVG 尺寸沿用现有模拟，仅验证解析和输出结构；真实 WebView 的缩放、裁切观感需实际设备验收。
- 远端构建：推送 `main` 会自动触发 Build（Windows/macOS 的 Lite/Plus）与 Pages（官网和在线体验部署）。使用现有工作流，运行结果记录在 `.local/mermaid-remote-build.json`；不打标签或创建桌面 Release。
- 待办：完成提交推送并跟进对应提交的 GitHub Actions；真实窗口显示仍需使用修复版打开原文档验收。
- 路径：`src/markdown/renderers/plus.ts`、`src/markdown/renderers/shared.ts`、`tests/markdown-regression.test.ts`。
