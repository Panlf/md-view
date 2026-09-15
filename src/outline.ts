import type { Heading } from './types';
import { isFenceClose, readFenceOpen } from './markdown/utils';

export function extractHeadingsFromMarkdown(source: string): Heading[] {
  const headings: Heading[] = [];
  let fence: { marker: string; length: number } | null = null;
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (fence) {
      if (isFenceClose(line, fence)) {
        fence = null;
      }
      continue;
    }

    const fenceOpen = readFenceOpen(line);
    if (fenceOpen) {
      fence = fenceOpen;
      continue;
    }

    const match = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const text = (match[2] ?? '').trim();
    if (!text) continue;
    const lineNumber = index + 1;
    headings.push({
      level: match[1]?.length ?? 1,
      text,
      line: lineNumber,
      anchor: `heading-${lineNumber}`
    });
  }

  return headings;
}
