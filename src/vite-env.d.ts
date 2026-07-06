/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MD_VIEW_EDITION?: 'lite' | 'plus';
  readonly VITE_MD_VIEW_VERSION?: string;
}

declare module '#markdown-renderer' {
  import type { Heading } from './types';
  import type { MarkdownRenderResult } from './markdown/renderers/shared';
  import type { PlusPreferences } from './plusPreferences';

  export function renderMarkdown(
    source: string,
    headings: Heading[],
    markdownPath: string,
    preferences?: PlusPreferences
  ): Promise<MarkdownRenderResult>;
}
