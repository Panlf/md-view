<script lang="ts">
  import { Plus, X, FileText } from 'lucide-svelte';
  import { dirty, filename, type DocumentSession } from '../state/documents';
  export let tabs: DocumentSession[] = [];
  export let activeId = '';
  export let onSelect: (id: string) => void;
  export let onClose: (id: string) => void;
  export let onCreate: () => void;
</script>

<div class="document-tabs" role="tablist" aria-label="打开的文档">
  {#each tabs as doc (doc.id)}
    <div class="document-tab" class:active={doc.id === activeId}>
      <button
        role="tab"
        aria-selected={doc.id === activeId}
        aria-controls="document-panel"
        title={doc.path || '未命名文档'}
        on:click={() => onSelect(doc.id)}
        on:auxclick={(event) => {
          if (event.button === 1) onClose(doc.id);
        }}
      >
        <FileText size={14} /><span>{filename(doc.path)}</span>{#if dirty(doc)}<span
            class="unsaved-mark"
            aria-label="未保存">●</span
          >{/if}
      </button>
      <button
        class="close-tab"
        title="关闭标签 (Ctrl+W)"
        aria-label={`关闭 ${filename(doc.path)}`}
        on:click={() => onClose(doc.id)}><X size={13} /></button
      >
    </div>
  {/each}
  <button class="new-tab" title="新建 (Ctrl+N)" aria-label="新建文档" on:click={onCreate}
    ><Plus size={16} /></button
  >
</div>
