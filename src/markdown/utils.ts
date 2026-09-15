/** Shared markdown helpers used by outline extraction and all renderers. */

export type FenceInfo = { marker: string; length: number };

const fenceCloseCache = new Map<string, RegExp>();

export function readFenceOpen(line: string): FenceInfo | null {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
  if (!match) return null;
  const fence = match[1] ?? '';
  return { marker: fence[0] ?? '`', length: fence.length };
}

export function isFenceClose(line: string, fence: FenceInfo): boolean {
  return fenceCloseRegex(fence.marker, fence.length).test(line);
}

export function fenceCloseRegex(marker: string, length: number): RegExp {
  const key = `${marker}${length}`;
  let pattern = fenceCloseCache.get(key);
  if (!pattern) {
    const escaped = marker === '`' ? '`' : '~';
    pattern = new RegExp(`^ {0,3}${escaped}{${length},}\\s*$`);
    fenceCloseCache.set(key, pattern);
  }
  return pattern;
}

export function slugHeading(text: string, index: number): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return slug ? `heading-${slug}` : `heading-${index + 1}`;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/\n/g, '&#10;');
}
