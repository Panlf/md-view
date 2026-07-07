/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MD_VIEW_EDITION?: 'lite' | 'plus';
  readonly VITE_MD_VIEW_VERSION?: string;
}

declare module '#markdown-renderer' {
  import type { Heading } from './types';
  import type { MarkdownRenderResult } from './markdown/renderers/shared';

  export function renderMarkdown(
    source: string,
    headings: Heading[],
    markdownPath: string,
    preferences?: unknown
  ): Promise<MarkdownRenderResult>;
}

declare module '#edition-app' {
  import type { Component } from 'svelte';

  const App: Component;
  export default App;
}
