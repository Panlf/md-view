<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AppText } from '../i18n';
  import type { Heading } from '../types';

  export let headings: Heading[] = [];
  export let strings: AppText['panels'];
  export let activeLine = 0;
  export let filter = '';

  const dispatch = createEventDispatcher<{ jump: Heading }>();

  $: normalizedFilter = filter.trim().toLowerCase();
  $: visibleHeadings = normalizedFilter
    ? headings.filter((heading) => heading.text.toLowerCase().includes(normalizedFilter))
    : headings;
</script>

<div class="outline-panel">
  {#if headings.length === 0}
    <p class="empty-note">{strings.emptyTitle}</p>
  {:else}
    {#each visibleHeadings as heading}
      <button
        class="outline-item"
        class:active={heading.line === activeLine}
        style={`--level: ${heading.level}`}
        title={`${strings.linePrefix} ${heading.line}${strings.lineSuffix ? ` ${strings.lineSuffix}` : ''}`}
        on:click={() => dispatch('jump', heading)}
      >
        {heading.text}
      </button>
    {/each}
  {/if}
</div>
