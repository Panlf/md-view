<script lang="ts">
  import MarkdownEditor from '../../src/components/MarkdownEditor.svelte';
  import type { EditorState } from '@codemirror/state';
  export let value = '';
  export let savedState: EditorState | null = null;
  export let onSnapshot: (state: EditorState) => void;
</script>

<MarkdownEditor
  {value}
  {savedState}
  on:change={(event) => (value = event.detail)}
  on:state={(event) => onSnapshot(event.detail.state)}
/>
