# Menu Bar Command Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 md-view 顶部菜单栏改为 B 方案的单行命令栏，并增加轻量底部状态栏。

**Architecture:** 继续由共享 `AppShell.svelte` 管理命令和状态，不引入新的业务状态层。CSS 负责三列单行布局和底部状态栏，i18n 提供新增的“更多”与状态栏标签，`lucide-svelte` 仅按需导入图标。

**Tech Stack:** Svelte 5、TypeScript、CSS Grid、Tauri 2、lucide-svelte、现有 edition 检查脚本。

---

### Task 1: 建立菜单栏结构回归检查

**Files:**
- Modify: `scripts/check-editions.mjs`
- Test: `scripts/check-editions.mjs`

- [ ] **Step 1: 写入失败检查**

```js
const appShell = readText('src/AppShell.svelte');
expectIncludes(appShell, 'class="status-bar"', 'shared bottom status bar');
expectIncludes(appShell, "openToolbarMenu === 'more'", 'shared More menu');
expectExcludes(appShell, '📂', 'shared toolbar emoji icons');

const appCss = readText('src/app.css');
expectIncludes(appCss, 'grid-template-rows: 48px minmax(0, 1fr) 24px;', 'shell command and status rows');
```

- [ ] **Step 2: 确认检查先失败**

Run: `npm run check:editions`

Expected: FAIL，缺少底部状态栏、更多菜单和三行 shell grid。

### Task 2: 实现单行命令栏与底部状态栏

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/AppShell.svelte`
- Modify: `src/i18n.ts`
- Modify: `src/app.css`

- [ ] **Step 1: 安装图标依赖**

Run: `npm install lucide-svelte --registry=https://registry.npmmirror.com/`

Expected: `lucide-svelte` 写入 dependencies，lockfile 同步更新。

- [ ] **Step 2: 重组 AppShell 命令入口**

```svelte
<header class="toolbar" aria-hidden={immersiveMode}>
  <div class="toolbar-group"><!-- 打开、保存、刷新 --></div>
  <div class="toolbar-center"><!-- 四种视图 --></div>
  <div class="toolbar-end"><!-- 外观、设置、更多 --></div>
</header>
<section class="workspace" style={workspaceStyle}>...</section>
<footer class="status-bar" aria-label={t.labels.statusBar}>...</footer>
```

`openToolbarMenu` 收敛为 `'open' | 'appearance' | 'more' | null`；原 `file` 菜单内容进入 `more`，原 `display` 菜单内容进入 `appearance`。

- [ ] **Step 3: 更新 i18n 与布局**

```ts
labels: {
  moreMenu: string;
  statusBar: string;
}
```

```css
.shell { grid-template-rows: 48px minmax(0, 1fr) 24px; }
.toolbar { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
.status-bar { display: flex; min-width: 0; align-items: center; }
```

删除 `900px` 时把共享桌面工具栏变为三行的规则；只在低于 Tauri 最小宽度的浏览器窗口提供两行降级。

- [ ] **Step 4: 运行结构和类型检查**

Run: `npm run check:editions`

Expected: PASS。

Run: `npm run check`

Expected: 0 errors。

### Task 3: 构建和渲染验收

**Files:**
- Verify: `src/AppShell.svelte`
- Verify: `src/app.css`

- [ ] **Step 1: 构建两个 edition**

Run: `npm run build:plus`

Expected: Vite build succeeds。

Run: `npm run build:lite`

Expected: Vite build succeeds，Lite 不包含 Plus 设置面板依赖。

- [ ] **Step 2: 浏览器布局验收**

启动 `npm run dev:plus`，检查 `1280x820` 和 `900x560`：工具栏为 48px、底栏为 24px、无横向滚动；打开外观和更多菜单，确认互斥和 Escape 关闭。

- [ ] **Step 3: 最终差异检查**

Run: `git diff --check`

Expected: 无空白错误；只包含计划内文件。
