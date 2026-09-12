<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Search, X, FileText } from 'lucide-svelte';
  import { filterSearchItems, type SearchItem } from '../state/search';
  import { modalFocus } from '../state/modal';
  export let localItems: SearchItem[] = [];
  export let scannedItems: SearchItem[] = [];
  export let workspace = '';
  export let headingsEnabled = false;
  export let busy = false;
  export let status = '';
  export let scanned = 0;
  export let skipped = 0;
  export let errors: string[] = [];
  export let incomplete = false;
  export let onClose: () => void;
  export let onSelect: (item: SearchItem) => void;
  export let onScan: (kind: 'files' | 'headings') => void;
  export let onCancel: () => void;
  let query = '';
  let input: HTMLInputElement;
  let selected = 0;
  $: source = [...localItems, ...scannedItems];
  $: items = filterSearchItems(source, query);
  $: if (selected >= items.length) selected = Math.max(0, items.length - 1);
  onMount(() => input.focus());
  async function key(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      selected = Math.max(0, Math.min(items.length - 1, selected + (event.key === 'ArrowDown' ? 1 : -1)));
      await tick();
      document.querySelector('.quick-results > .highlighted')?.scrollIntoView({ block: 'nearest' });
    }
    if (event.key === 'Enter' && items[selected]) {
      event.preventDefault();
      onSelect(items[selected]);
    }
  }
</script>

<div class="dialog-backdrop" role="presentation" on:click={onClose}></div>
<div
  class="quick-open app-dialog"
  role="dialog"
  aria-modal="true"
  aria-label="快速打开"
  tabindex="-1"
  on:keydown={key}
  use:modalFocus
>
  <div class="quick-input">
    <Search size={18} /><input
      bind:this={input}
      bind:value={query}
      on:input={() => (selected = 0)}
      placeholder="搜索已打开、最近和已加载的文件…"
      aria-label="文件或标题"
    /><button aria-label="关闭搜索" on:click={onClose}><X size={17} /></button>
  </div>
  <div class="quick-scopes">
    <span>工作区</span><button disabled={!workspace || busy} on:click={() => onScan('files')}
      >搜索文件名</button
    >{#if headingsEnabled}<button disabled={!workspace || busy} on:click={() => onScan('headings')}
        >搜索标题</button
      >{/if}{#if busy}<button on:click={onCancel}>停止</button>{/if}
  </div>
  <div class="quick-results">
    {#each items as item, i (`${item.path}:${item.line ?? 0}`)}
      <button class:highlighted={i === selected} on:click={() => onSelect(item)}
        ><FileText size={16} /><span><strong>{item.label}</strong><small>{item.detail}</small></span></button
      >
    {/each}
    {#if !items.length}<p class="browser-empty">没有匹配结果。可选择上方的工作区搜索。</p>{/if}
  </div>
  <footer class:incomplete>
    {status || '仅查找已打开、最近使用和已加载的文件'}{#if scanned}
      · {scanned.toLocaleString()} 项{/if}{#if skipped}
      · 跳过 {skipped} 项{/if}
  </footer>
  {#if errors.length}<details class="search-errors">
      <summary>访问失败的条目（最多显示 50 条）</summary>{#each errors as error}<p>{error}</p>{/each}
    </details>{/if}
</div>
