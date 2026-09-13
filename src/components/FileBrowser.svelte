<script lang="ts">
  import { tick } from 'svelte';
  import {
    ChevronRight,
    ChevronDown,
    FileText,
    Folder,
    FolderOpen,
    RefreshCw,
    FolderPlus,
    FilePlus2,
    MoreHorizontal
  } from 'lucide-svelte';
  import { flattenTree, type Workspace, type TreeRow } from '../state/workspace';
  import { filename, isWithin, parentPath, pathKey } from '../state/documents';
  import type { DirectoryEntry } from '../types';
  export let workspace: Workspace;
  export let selectedPath = '';
  export let onSelect: (entry: DirectoryEntry) => void;
  export let onRefresh: (path: string) => void;
  export let onMenu: (entry: DirectoryEntry, x: number, y: number) => void;
  export let onNewFile: () => void;
  export let onNewFolder: () => void;
  export let onChoose: () => void;
  export let onMoveEntry: (source: DirectoryEntry, targetDir: string) => void = () => {};
  let viewport: HTMLDivElement;
  let scrollTop = 0;
  let height = 480;
  const rowHeight = 32;
  const DRAG_THRESHOLD = 6;
  // 指针拖拽（而非 HTML5 dnd）：Tauri 的原生拖放处理会吞掉 WebView2 页面内 dnd 事件。
  // dragCandidate=按住未拖动；dragging=超过阈值进入拖拽；dragOverPath 驱动目标高亮。
  let dragCandidate: { row: TreeRow; pointerId: number; startX: number; startY: number } | null = null;
  let dragging: TreeRow | null = null;
  let dragOverPath = '';
  let suppressClick = false;
  $: rows = flattenTree(workspace);
  $: start = Math.max(0, Math.floor(scrollTop / rowHeight) - 6);
  $: visible = rows.slice(start, start + Math.ceil(height / rowHeight) + 12);
  $: root = workspace.directories[workspace.root];
  async function key(event: KeyboardEvent, row: TreeRow, index: number) {
    if (
      (event.key === 'ArrowRight' && row.entry.kind === 'directory' && !row.expanded) ||
      (event.key === 'ArrowLeft' && row.expanded)
    ) {
      event.preventDefault();
      onSelect(row.entry);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const next = Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    if (next * rowHeight < viewport.scrollTop) viewport.scrollTop = next * rowHeight;
    if ((next + 1) * rowHeight > viewport.scrollTop + height)
      viewport.scrollTop = (next + 1) * rowHeight - height;
    scrollTop = viewport.scrollTop;
    await tick();
    viewport.querySelector<HTMLButtonElement>(`[data-row="${next}"]`)?.focus();
  }
  function dropAllowed(targetDir: string, source: TreeRow | null = dragging) {
    if (!source) return false;
    const src = source.entry.path;
    // 目标是自己、自己所在目录、或自己的子目录时拒绝放置。
    if (pathKey(src) === pathKey(targetDir)) return false;
    if (pathKey(parentPath(src)) === pathKey(targetDir)) return false;
    if (isWithin(targetDir, src)) return false;
    return true;
  }
  function hitTestDir(x: number, y: number): string {
    const el = document.elementFromPoint(x, y)?.closest?.('.file-row[data-path], .browser-heading');
    if (!el) return '';
    if (el.classList.contains('browser-heading')) {
      return dropAllowed(workspace.root) ? workspace.root : '';
    }
    const path = el.getAttribute('data-path') ?? '';
    const row = rows.find((candidate) => pathKey(candidate.entry.path) === pathKey(path));
    if (!row || row.entry.kind !== 'directory' || !dropAllowed(path)) return '';
    return path;
  }
  function rowPointerDown(event: PointerEvent, row: TreeRow) {
    // 仅鼠标启用拖拽：触屏按下后滑动是滚动手势，不能劫持成拖动。
    if (event.button !== 0 || event.pointerType !== 'mouse') return;
    dragCandidate = { row, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
  }
  function windowPointerCancel(event: PointerEvent) {
    if (dragCandidate && event.pointerId === dragCandidate.pointerId) {
      dragCandidate = null;
      dragging = null;
      dragOverPath = '';
    }
  }
  function windowPointerMove(event: PointerEvent) {
    if (!dragCandidate || event.pointerId !== dragCandidate.pointerId) return;
    if (!dragging) {
      const dx = event.clientX - dragCandidate.startX;
      const dy = event.clientY - dragCandidate.startY;
      if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) dragging = dragCandidate.row;
    }
    if (!dragging) return;
    event.preventDefault();
    dragOverPath = hitTestDir(event.clientX, event.clientY);
  }
  function windowPointerUp(event: PointerEvent) {
    if (!dragCandidate || event.pointerId !== dragCandidate.pointerId) return;
    const wasDragging = Boolean(dragging);
    const source = dragging;
    const target = wasDragging ? hitTestDir(event.clientX, event.clientY) : '';
    dragCandidate = null;
    dragging = null;
    dragOverPath = '';
    if (!wasDragging) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    if (!source || !target) return;
    onMoveEntry(source.entry, target);
    const targetRow = rows.find((candidate) => pathKey(candidate.entry.path) === pathKey(target));
    if (targetRow && !targetRow.expanded) onSelect(targetRow.entry);
  }
</script>

<div class="browser-heading">
  <button
    class="workspace-name"
    class:drop-root={dragOverPath === workspace.root && Boolean(workspace.root)}
    title={workspace.root || '打开文件夹'}
    on:click={onChoose}
    ><FolderOpen size={15} /><span>{workspace.root ? filename(workspace.root) : '文件'}</span></button
  >
  <div class="small-actions">
    <button aria-label="新建文件" title="新建文件" on:click={onNewFile}><FilePlus2 size={15} /></button>
    <button aria-label="新建文件夹" title="新建文件夹" disabled={!workspace.root} on:click={onNewFolder}
      ><FolderPlus size={15} /></button
    >
    <button
      aria-label="刷新目录"
      title="刷新已展开目录"
      disabled={!workspace.root}
      on:click={() => onRefresh(workspace.root)}><RefreshCw size={14} /></button
    >
  </div>
</div>
{#if !workspace.root}
  <div class="browser-empty">
    <p>打开文件夹后，在这里浏览文档。</p>
    <button on:click={onChoose}>打开文件夹</button>
  </div>
{:else}
  {#if root?.errors.length}<div class="inline-error" role="status">
      {root.errors[0]}<button on:click={() => onRefresh(workspace.root)}>重试</button>
    </div>{/if}
  {#if !rows.length}<p class="browser-empty">
      {root?.loading ? '正在读取目录…' : '此目录没有可显示的 Markdown 或文本文件。'}
    </p>{/if}
  <div
    class="file-viewport"
    bind:this={viewport}
    bind:clientHeight={height}
    tabindex="-1"
    on:scroll={() => (scrollTop = viewport.scrollTop)}
    role="tree"
    aria-label="工作区文件"
  >
    <div class="file-spacer" style={`height: ${rows.length * rowHeight}px`} role="presentation">
      {#each visible as row, i (row.entry.path)}
        <div
          class="file-row"
          class:selected={pathKey(row.entry.path) === pathKey(selectedPath)}
          class:drag-over={dragOverPath === row.entry.path}
          data-path={row.entry.path}
          style={`top:${(start + i) * rowHeight}px;padding-left:${8 + row.depth * 16}px`}
          role="presentation"
        >
          <button
            data-row={start + i}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-selected={pathKey(row.entry.path) === pathKey(selectedPath)}
            aria-expanded={row.entry.kind === 'directory' ? row.expanded : undefined}
            title={row.error || row.entry.path}
            on:click={() => {
              if (suppressClick) return;
              onSelect(row.entry);
            }}
            on:pointerdown={(event) => rowPointerDown(event, row)}
            on:keydown={(event) => key(event, row, start + i)}
            on:contextmenu|preventDefault={(event) => onMenu(row.entry, event.clientX, event.clientY)}
          >
            {#if row.entry.kind === 'directory'}{#if row.expanded}<ChevronDown
                  size={12}
                />{:else}<ChevronRight size={12} />{/if}<Folder size={14} />{:else}<FileText size={14} />{/if}
            <span>{row.entry.name}</span>{#if row.loading}<small>加载中</small>{:else if row.error}<small
                class="error-mark">访问失败</small
              >{:else if row.expanded && workspace.directories[row.entry.path]?.loaded && !workspace.directories[row.entry.path]?.entries.length}<small
                >空目录</small
              >{/if}
          </button>
          <button
            class="row-more"
            aria-label={`${row.entry.name} 的操作`}
            on:click|stopPropagation={(event) => onMenu(row.entry, event.clientX, event.clientY)}
            ><MoreHorizontal size={13} /></button
          >
        </div>
      {/each}
    </div>
  </div>
{/if}

<svelte:window
  on:pointermove={windowPointerMove}
  on:pointerup={windowPointerUp}
  on:pointercancel={windowPointerCancel}
/>
