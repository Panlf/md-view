import { beforeAll, describe, expect, it } from 'vitest';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderPlusMarkdown } from '../src/markdown/renderers/plus';
import { renderFastMarkdown } from '../src/markdown/renderers/fast';
import { extractHeadingsFromMarkdown } from '../src/outline';
import { defaultPlusPreferences } from '../src/plusPreferences';
import { createDocuments } from '../src/state/documents';

// JSDOM has no SVG layout. These measurements allow Mermaid's real parser and
// SVG generator to run; visual diagram layout remains a desktop acceptance check.
beforeAll(() => {
  Object.defineProperty(SVGElement.prototype, 'getBBox', {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 120, height: 30 })
  });
  Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
    configurable: true,
    value: () => 120
  });
});

describe('existing Markdown sample', () => {
  it('retains formulas, Mermaid SVGs, tables and navigable heading aliases', async () => {
    const source = await readFile(resolve('docs/plus-markdown-syntax-sample.md'), 'utf8');
    const rendered = await renderPlusMarkdown(source, {
      headings: extractHeadingsFromMarkdown(source),
      markdownPath: '/docs/sample.md'
    });
    const html = document.createElement('div');
    html.innerHTML = rendered.html;
    expect(html.querySelectorAll('.katex').length).toBeGreaterThan(1);
    expect(html.querySelectorAll('.markdown-mermaid svg').length).toBe(2);
    expect(html.querySelector('table')).not.toBeNull();
    expect(html.querySelector('#mermaid')).not.toBeNull();
    expect(rendered.linkTargets).toContainEqual({ href: './missing-note.md', kind: 'link' });
  }, 30000);

  it('preserves local file fragments and deduplicates heading aliases', async () => {
    const source = '# Intro\n\n# Intro\n\n[other](./other.md#intro)';
    const rendered = await renderPlusMarkdown(
      source,
      { headings: extractHeadingsFromMarkdown(source), markdownPath: '/docs/a.md' },
      { ...defaultPlusPreferences, mermaidEnabled: false }
    );
    const html = document.createElement('div');
    html.innerHTML = rendered.html;
    expect(html.querySelector('#intro')).not.toBeNull();
    expect(html.querySelector('#intro-1')).not.toBeNull();
    expect(html.querySelector('[data-local-file]')?.getAttribute('data-source-href')).toBe(
      './other.md#intro'
    );
  });
});

it.runIf(process.env.MD_VIEW_BENCHMARK === '1')(
  'measures large Markdown rendering separately from disk access',
  async () => {
    const paragraph =
      'Large document paragraph: ' + 'plain text for reading performance. '.repeat(14) + '\n\n';
    const source = '# Large document\n\n' + paragraph.repeat(4200);
    const bytes = new TextEncoder().encode(source).length;
    expect(bytes).toBeGreaterThan(2 * 1024 * 1024);
    const docs = createDocuments();
    const id = docs.open({
      id: '/large.md',
      path: '/large.md',
      content: source,
      encoding: 'UTF-8',
      bom: false,
      newline: 'lf',
      revision: { modified: '1', size: bytes, hash: '' }
    });
    expect(docs.find(id)?.mode).toBe('edit');
    const context = { headings: extractHeadingsFromMarkdown(source), markdownPath: '/large.md' };
    let start = performance.now();
    const fast = renderFastMarkdown(source, context);
    const fastMs = performance.now() - start;
    start = performance.now();
    const full = await renderPlusMarkdown(source, context, {
      ...defaultPlusPreferences,
      mermaidEnabled: false
    });
    const fullMs = performance.now() - start;
    expect(fast.html).toContain('Large document');
    expect(full.html).toContain('Large document');
    await mkdir(resolve('.local'), { recursive: true });
    const report = {
      bytes,
      fast_ms: Math.round(fastMs),
      full_plus_ms: Math.round(fullMs),
      initial_mode: docs.find(id)?.mode,
      scope: 'In-memory Markdown render in JSDOM; excludes file I/O, scanning and native WebView painting'
    };
    await writeFile(
      resolve('.local/render-performance.json'),
      JSON.stringify(report, null, 2) + '\n',
      'utf8'
    );
    console.log(report);
  },
  60000
);
