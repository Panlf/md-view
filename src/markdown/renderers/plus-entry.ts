import type { Heading } from '../../types';
import type { PlusPreferences } from '../../plusPreferences';
import { renderPlusMarkdown } from './plus';
import type { MarkdownRenderResult } from './shared';

export function renderMarkdown(
  source: string,
  headings: Heading[],
  markdownPath: string,
  preferences?: PlusPreferences
): Promise<MarkdownRenderResult> {
  return renderPlusMarkdown(source, { headings, markdownPath }, preferences);
}
