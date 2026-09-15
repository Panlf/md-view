<script lang="ts">
  import { onMount } from 'svelte';
  import MarkdownPreview from './components/MarkdownPreview.svelte';
  import PlusSettingsPanel from './components/PlusSettingsPanel.svelte';
  import { appVersion, editionDisplayName, plusMarkdownStatus } from './edition';
  import { extractHeadingsFromMarkdown } from './outline';
  import { renderFullMarkdown } from './markdown/renderers/deferred';
  import { escapeHtml } from './markdown/utils';
  import { applyTheme, findTheme, THEME_STORAGE_KEY, themes } from './themes';
  import {
    defaultPlusPreferences,
    loadPlusPreferences,
    plusReaderStyle,
    savePlusPreferences,
    type PlusPreferences
  } from './plusPreferences';
  import type { AppTheme } from './types';

  type WebViewMode = 'source' | 'split' | 'read';

  const sampleMarkdown = `---
title: md-view Plus Web
tags:
  - Markdown
  - GitHub Pages
---

# md-view Plus Web

在线编辑 Markdown，右侧实时预览。支持 **GFM**、Frontmatter、数学公式、代码高亮、Mermaid、任务列表和提示块。

## 示例

- [x] 实时预览
- [x] Plus Markdown 渲染
- [ ] 保存到本地文件

> [!TIP] 在线版不会上传内容
> 当前文档只在浏览器内处理，可以下载为 Markdown 或 HTML。

## 数学公式

行内公式 $E = mc^2$，块级公式：

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$

## Mermaid

\`\`\`mermaid
flowchart LR
  A[编辑] --> B[预览]
  B --> C[导出]
\`\`\`
`;

  let content = sampleMarkdown;
  let fileName = 'md-view-plus-web.md';
  let mode: WebViewMode = 'split';
  let preferences: PlusPreferences = defaultPlusPreferences;
  let settingsOpen = false;
  let renderStatus = plusMarkdownStatus;
  let renderedHtml = '';
  let renderedSource = content;
  let exporting = false;
  let exportError = '';
  let readingProgress = 0;
  let readingFocusEnabled = true;
  let selectedTheme: AppTheme = themes[0];
  let MarkdownEditorComponent: any = null;
  let editorLoadPromise: Promise<void> | null = null;
  let editorRef: any;
  const productUrl = import.meta.env.BASE_URL.replace(/play\/$/, '');

  $: appTitle = appVersion ? `${editionDisplayName} ${appVersion}` : editionDisplayName;
  $: outline = extractHeadingsFromMarkdown(content);
  $: contentPaneStyle = plusReaderStyle(preferences);
  $: wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  $: charCount = content.length;
  $: if (content !== renderedSource) {
    renderedSource = content;
    renderedHtml = '';
  }

  onMount(() => {
    preferences = loadPlusPreferences();
    readingFocusEnabled = localStorage.getItem('md-view-reading-focus-enabled') !== 'false';
    selectedTheme = findTheme(localStorage.getItem(THEME_STORAGE_KEY));
    applyTheme(selectedTheme);
    void ensureMarkdownEditorLoaded();
  });

  async function ensureMarkdownEditorLoaded() {
    if (MarkdownEditorComponent) return;
    editorLoadPromise ??= import('./components/MarkdownEditor.svelte').then((module) => {
      MarkdownEditorComponent = module.default;
    });
    await editorLoadPromise;
  }

  function setMode(next: WebViewMode) {
    mode = next;
    if (next !== 'read') {
      void ensureMarkdownEditorLoaded();
    }
  }

  function updateReadingFocusEnabled(enabled: boolean) {
    readingFocusEnabled = enabled;
    localStorage.setItem('md-view-reading-focus-enabled', String(enabled));
  }

  function updatePreferences(next: PlusPreferences) {
    preferences = next;
    renderedHtml = '';
    savePlusPreferences(next);
  }

  function resetPreferences() {
    updatePreferences(defaultPlusPreferences);
  }

  function updateTheme(themeName: string) {
    const next = themes.find((theme) => theme.name === themeName) ?? themes[0];
    selectedTheme = next;
    applyTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next.id);
  }

  async function importMarkdown(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    content = await file.text();
    if (file.size > 2 * 1024 * 1024) mode = 'source';
    fileName = file.name || 'document.md';
  }

  function downloadMarkdown() {
    downloadText(safeFileName(fileName, 'document.md'), content, 'text/markdown;charset=utf-8');
  }

  async function downloadHtml() {
    if (exporting) return;
    exporting = true;
    exportError = '';
    const title = fileName.replace(/\.(md|markdown)$/i, '') || 'md-view-plus';
    try {
      const body = renderedHtml || (await renderFullMarkdown(content, outline, fileName, preferences)).html;
      const html = [
        '<!doctype html>',
        '<html lang="zh-CN">',
        '<head>',
        '<meta charset="UTF-8" />',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        `<title>${escapeHtml(title)}</title>`,
        '<style>',
        ':root{font-family:"Microsoft YaHei UI","Segoe UI",system-ui,sans-serif;color:#1d2826;background:#fff}',
        'body{margin:0;padding:32px}',
        '.markdown-preview{max-width:920px;margin:0 auto;line-height:1.75}',
        'pre{overflow:auto;padding:12px;background:#f6f9f8;border-radius:8px}',
        'code{background:#edf3f1;padding:0.1em 0.3em;border-radius:4px}',
        'img{max-width:100%}',
        '</style>',
        '</head>',
        '<body>',
        `<article class="markdown-preview">${body}</article>`,
        '</body>',
        '</html>'
      ].join('\n');
      downloadText(`${title}.html`, html, 'text/html;charset=utf-8');
    } catch (error) {
      exportError = `导出失败：${String(error)}`;
    } finally {
      exporting = false;
    }
  }

  function downloadText(name: string, text: string, type: string) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function safeFileName(name: string, fallback: string) {
    const trimmed = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');
    return trimmed || fallback;
  }
</script>

<main class="web-plus-shell">
  <nav class="web-demo-navigation" aria-label="产品导航">
    <a href={productUrl}>← md-view 产品介绍</a><span>浏览器体验 · 本地文件夹管理与草稿请使用桌面版</span><a
      href="https://github.com/T-meow/md-view/releases/latest"
      target="_blank"
      rel="noopener noreferrer">下载桌面版 ↗</a
    >
  </nav>
  <header class="web-plus-toolbar">
    <div class="web-plus-brand">
      <strong>{appTitle}</strong>
      <span>文档在此浏览器内处理 · 阅读 {readingProgress}% · {charCount} 字符</span>
    </div>

    <div class="web-plus-controls">
      <label class="web-plus-file-button">
        导入
        <input type="file" accept=".md,.markdown,text/markdown,text/plain" on:change={importMarkdown} />
      </label>
      <button type="button" on:click={downloadMarkdown}>下载 MD</button>
      <button type="button" disabled={exporting} on:click={downloadHtml}
        >{exporting ? '正在导出…' : '下载 HTML'}</button
      >
      {#if exportError}<span role="alert">{exportError}</span>{/if}
      <button type="button" on:click={() => window.print()}>打印/PDF</button>
      <button type="button" on:click={() => (settingsOpen = true)}>Plus</button>
      <label class="web-plus-check">
        <input
          type="checkbox"
          checked={readingFocusEnabled}
          on:change={(event) => updateReadingFocusEnabled(event.currentTarget.checked)}
        />
        <span>高亮</span>
      </label>
      <select
        value={selectedTheme.name}
        on:change={(event) => updateTheme(event.currentTarget.value)}
        aria-label="主题"
      >
        {#each themes as theme}
          <option value={theme.name}>{theme.name}</option>
        {/each}
      </select>
    </div>

    <div class="segmented web-plus-modes" aria-label="视图">
      <button type="button" class:active={mode === 'source'} on:click={() => setMode('source')}>源码</button>
      <button type="button" class:active={mode === 'split'} on:click={() => setMode('split')}>分屏</button>
      <button type="button" class:active={mode === 'read'} on:click={() => setMode('read')}>阅读</button>
    </div>
  </header>

  <section
    class:source-view={mode === 'source'}
    class:read-view={mode === 'read'}
    class:split-view={mode === 'split'}
    class="web-plus-workspace"
  >
    {#if mode !== 'read'}
      <section class="web-plus-editor-panel">
        <input class="web-plus-title" bind:value={fileName} aria-label="文件名" />
        {#if MarkdownEditorComponent}
          <svelte:component
            this={MarkdownEditorComponent}
            bind:this={editorRef}
            value={content}
            on:change={(event: CustomEvent<string>) => (content = event.detail)}
          />
        {:else}
          <div class="empty-state">
            <p>正在加载编辑器</p>
          </div>
        {/if}
      </section>
    {/if}

    {#if mode !== 'source'}
      <section class="web-plus-preview-panel" style={contentPaneStyle}>
        <MarkdownPreview
          {content}
          {outline}
          {preferences}
          filePath={fileName}
          fallbackRenderStatus={plusMarkdownStatus}
          {readingFocusEnabled}
          on:renderStatus={(event) => (renderStatus = event.detail)}
          on:renderHtml={(event) => (renderedHtml = event.detail)}
          on:readingProgress={(event) => (readingProgress = event.detail)}
        />
      </section>
    {/if}
  </section>
</main>

<PlusSettingsPanel
  open={settingsOpen}
  {preferences}
  onChange={updatePreferences}
  onClose={() => (settingsOpen = false)}
  onReset={resetPreferences}
  onExportHtml={downloadHtml}
  onPrint={() => window.print()}
/>
