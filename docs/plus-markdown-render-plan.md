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
