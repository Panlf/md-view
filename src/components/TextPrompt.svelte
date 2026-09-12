<script lang="ts">
  import { onMount } from 'svelte';
  import { modalFocus } from '../state/modal';
  export let title: string;
  export let value = '';
  export let onDone: (value: string | null) => void;
  let input: HTMLInputElement;
  onMount(() => {
    input.focus();
    input.select();
  });
</script>

<div class="dialog-backdrop" role="presentation" on:click={() => onDone(null)}></div>
<div
  class="text-prompt app-dialog"
  role="dialog"
  aria-modal="true"
  aria-label={title}
  tabindex="-1"
  on:keydown={(event) => {
    if (event.key === 'Escape') onDone(null);
  }}
  use:modalFocus
>
  <form on:submit|preventDefault={() => onDone(value.trim())}>
    <h2>{title}</h2>
    <input bind:this={input} bind:value aria-label={title} required />
    <div class="dialog-actions">
      <button type="button" on:click={() => onDone(null)}>取消</button><button class="primary" type="submit"
        >确定</button
      >
    </div>
  </form>
</div>
