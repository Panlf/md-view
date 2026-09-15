import type { Heading } from '../../types';
import { escapeAttribute, escapeHtml, isFenceClose, readFenceOpen } from '../utils';
import type { MarkdownRenderContext, MarkdownRenderResult } from './shared';

type Fence = {
  marker: string;
  length: number;
  language: string;
  line: number;
  lines: string[];
};

export function renderFastMarkdown(source: string, context: MarkdownRenderContext): MarkdownRenderResult {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: Array<{ ordered: boolean; text: string }> = [];
  let fence: Fence | null = null;

  // O(1) 按行号取大纲标题，避免每个标题行对 headings 做线性扫描。
  const headingByLine = new Map<number, Heading>();
  for (const heading of context.headings) {
    headingByLine.set(heading.line, heading);
  }

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInline(paragraph.join(' ').trim())}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    const ordered = list[0]?.ordered ?? false;
    const items = list.map((item) => `<li>${renderInline(item.text)}</li>`).join('');
    html.push(`<${ordered ? 'ol' : 'ul'}>${items}</${ordered ? 'ol' : 'ul'}>`);
    list = [];
  };

  const flushBlocks = () => {
    flushParagraph();
    flushList();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const lineNumber = index + 1;

    if (fence) {
      if (isFenceClose(line, fence)) {
        html.push(renderCodeBlock(fence.lines.join('\n'), fence.language));
        fence = null;
      } else {
        fence.lines.push(line);
      }
      continue;
    }

    const fenceOpen = readFenceOpenWithLanguage(line);
    if (fenceOpen) {
      flushBlocks();
      fence = { ...fenceOpen, line: lineNumber, lines: [] };
      continue;
    }

    if (!line.trim()) {
      flushBlocks();
      continue;
    }

    const heading = readHeading(line, headingByLine, lineNumber);
    if (heading) {
      flushBlocks();
      html.push(
        `<h${heading.level} id="${escapeAttribute(heading.anchor)}" data-outline-line="${heading.line}">${renderInline(
          heading.text
        )}</h${heading.level}>`
      );
      continue;
    }

    if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushBlocks();
      html.push('<hr>');
      continue;
    }

    const quote = line.match(/^ {0,3}>\s?(.*)$/);
    if (quote) {
      flushBlocks();
      html.push(`<blockquote><p>${renderInline(quote[1] ?? '')}</p></blockquote>`);
      continue;
    }

    const listItem = line.match(/^ {0,3}(?:([-+*])|(\d+)[.)])\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      const ordered = Boolean(listItem[2]);
      if (list.length > 0 && list[0]?.ordered !== ordered) {
        flushList();
      }
      list.push({ ordered, text: listItem[3] ?? '' });
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  if (fence) {
    html.push(renderCodeBlock(fence.lines.join('\n'), fence.language));
  }
  flushBlocks();

  return {
    html: html.join('\n'),
    status: 'Quick Preview'
  };
}

function readHeading(line: string, headingByLine: Map<number, Heading>, lineNumber: number) {
  const match = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
  if (!match) return null;
  const text = (match[2] ?? '').trim();
  if (!text) return null;
  const outlineHeading = headingByLine.get(lineNumber);
  return {
    anchor: outlineHeading?.anchor || `heading-${lineNumber}`,
    level: match[1]?.length ?? 1,
    line: lineNumber,
    text
  };
}

function readFenceOpenWithLanguage(line: string) {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})\s*([A-Za-z0-9_-]+)?/);
  if (!match) return null;
  const fence = match[1] ?? '';
  return {
    marker: fence[0] ?? '`',
    length: fence.length,
    language: match[2] ?? ''
  };
}

function renderCodeBlock(source: string, language: string) {
  const className = language ? ` class="language-${escapeAttribute(language)}"` : '';
  return `<pre><code${className}>${escapeHtml(source)}</code></pre>`;
}

function renderInline(source: string) {
  return escapeHtml(source)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>');
}
