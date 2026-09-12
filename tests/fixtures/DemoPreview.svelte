<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  export let content = '';
  export const outline: unknown = undefined;
  export const preferences: unknown = undefined;
  export const filePath = '';
  export const fallbackRenderStatus = '';
  export const readingFocusEnabled = true;
  const dispatch = createEventDispatcher<{ renderHtml: string }>();
  $: dispatch('renderHtml', `<p>${content}</p>`);
</script>

<div data-testid="preview-content">{content}</div>
