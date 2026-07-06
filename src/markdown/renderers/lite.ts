import { marked } from 'marked';
import type { MarkdownRenderContext, MarkdownRenderResult } from './shared';
import { postProcessMarkdownHtml } from './shared';

marked.setOptions({
  gfm: true,
  breaks: false
});

export async function renderLiteMarkdown(source: string, context: MarkdownRenderContext): Promise<MarkdownRenderResult> {
  const raw = marked.parse(source, { async: false }) as string;
  return {
    html: postProcessMarkdownHtml(raw, context),
    status: 'Lite Markdown'
  };
}
