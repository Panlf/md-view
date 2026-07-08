import type { Heading } from '../../types';
import { renderFastMarkdown } from './fast';
import type { MarkdownRenderResult } from './shared';

type RendererModule = {
  renderMarkdown: (
    source: string,
    headings: Heading[],
    markdownPath: string,
    preferences?: unknown
  ) => Promise<MarkdownRenderResult>;
};

let rendererPromise: Promise<RendererModule> | null = null;

export function renderFastPreview(source: string, headings: Heading[], markdownPath: string): MarkdownRenderResult {
  return renderFastMarkdown(source, { headings, markdownPath });
}

export async function renderFullMarkdown(
  source: string,
  headings: Heading[],
  markdownPath: string,
  preferences?: unknown
): Promise<MarkdownRenderResult> {
  const renderer = await loadRenderer();
  return renderer.renderMarkdown(source, headings, markdownPath, preferences);
}

export function warmMarkdownRenderer(): Promise<void> {
  return loadRenderer().then(() => undefined);
}

function loadRenderer() {
  if (!rendererPromise) {
    rendererPromise = import('#markdown-renderer') as Promise<RendererModule>;
  }
  return rendererPromise;
}
