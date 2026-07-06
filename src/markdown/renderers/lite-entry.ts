import type { Heading } from '../../types';
import { renderLiteMarkdown } from './lite';
import type { MarkdownRenderResult } from './shared';

export function renderMarkdown(source: string, headings: Heading[], markdownPath: string, _preferences?: unknown): Promise<MarkdownRenderResult> {
  return renderLiteMarkdown(source, { headings, markdownPath });
}
