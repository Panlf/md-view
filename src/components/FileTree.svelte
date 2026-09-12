<script lang="ts">
  import type { FileNode } from '../types';

  export let nodes: FileNode[] = [];
  export let selectedPath = '';
  export let depth = 0;
  // 展开的目录集合由 AppShell 持有（跨刷新保持），默认为空即全部折叠。
  export let expandedPaths: ReadonlySet<string> = new Set<string>();
  export let onSelectFile: (path: string) => void = () => {};
  export let onToggleDirectory: (path: string) => void = () => {};

  function isExpanded(node: FileNode) {
    return node.kind === 'directory' && expandedPaths.has(node.path);
  }

  function activate(node: FileNode) {
    if (node.kind === 'file') {
      onSelectFile(node.path);
      return;
    }
    onToggleDirectory(node.path);
  }
</script>

<ul class="file-tree" class:nested={depth > 0}>
  {#each nodes as node (node.path)}
    <li>
      <button
        type="button"
        class:selected={node.path === selectedPath}
        class:directory={node.kind === 'directory'}
        class:file={node.kind === 'file'}
        style={`--depth: ${depth}`}
        title={node.path}
        on:click={() => activate(node)}
      >
        <span class="twist" class:expanded={isExpanded(node)}>{node.kind === 'directory' ? '▸' : '·'}</span>
        <span class="label">{node.name}</span>
      </button>
      <!-- 折叠的目录不渲染子树，大目录下也只维护可见节点。 -->
      {#if node.kind === 'directory' && expandedPaths.has(node.path)}
        <svelte:self
          nodes={node.children}
          {selectedPath}
          {expandedPaths}
          {onSelectFile}
          {onToggleDirectory}
          depth={depth + 1}
        />
      {/if}
    </li>
  {/each}
</ul>
