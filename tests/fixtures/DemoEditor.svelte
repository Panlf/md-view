<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  export const value = '';
  const dispatch = createEventDispatcher<{ change: string }>();
</script>

<button data-testid="type-document" on:click={() => dispatch('change', '# Edited from the editor')}
  >Type document</button
>
