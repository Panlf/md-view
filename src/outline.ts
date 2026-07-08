import type { Heading } from './types';

export function extractHeadingsFromMarkdown(source: string): Heading[] {
  const headings: Heading[] = [];
  let fence: { marker: string; length: number } | null = null;

  source.replace(/\r\n?/g, '\n').split('\n').forEach((line, index) => {
    if (fence) {
      if (isFenceClose(line, fence)) {
        fence = null;
      }
      return;
    }

    const fenceOpen = readFenceOpen(line);
    if (fenceOpen) {
      fence = fenceOpen;
      return;
    }

    const match = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) return;
    const text = (match[2] ?? '').trim();
    if (!text) return;
    const lineNumber = index + 1;
    headings.push({
      level: match[1]?.length ?? 1,
      text,
      line: lineNumber,
      anchor: `heading-${lineNumber}`
    });
  });

  return headings;
}

function readFenceOpen(line: string) {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
  if (!match) return null;
  const fence = match[1] ?? '';
  return { marker: fence[0] ?? '`', length: fence.length };
}

function isFenceClose(line: string, fence: { marker: string; length: number }) {
  const escaped = fence.marker === '`' ? '`' : '~';
  return new RegExp(`^ {0,3}${escaped}{${fence.length},}\\s*$`).test(line);
}
