import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { Blob as NodeBlob } from 'node:buffer';
vi.mock('../src/components/MarkdownEditor.svelte', async () => ({
  default: (await import('./fixtures/DemoEditor.svelte')).default
}));
vi.mock('../src/components/MarkdownPreview.svelte', async () => ({
  default: (await import('./fixtures/DemoPreview.svelte')).default
}));
import WebPlusApp from '../src/WebPlusApp.svelte';
let app: ReturnType<typeof mount>;
afterEach(async () => {
  if (app) await unmount(app);
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function setupDemo() {
  const downloads: NodeBlob[] = [];
  vi.stubGlobal('Blob', NodeBlob);
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: NodeBlob) => {
      downloads.push(blob);
      return 'blob:test';
    })
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  app = mount(WebPlusApp, { target: document.body });
  await vi.waitFor(() => expect(document.querySelector('[data-testid="type-document"]')).not.toBeNull());
  return downloads;
}
it('editor change events update preview, Markdown download and HTML export', async () => {
  const downloads = await setupDemo();
  (document.querySelector('[data-testid="type-document"]') as HTMLButtonElement).click();
  await tick();
  expect(document.querySelector('[data-testid="preview-content"]')?.textContent).toBe(
    '# Edited from the editor'
  );
  [...document.querySelectorAll('button')].find((button) => button.textContent === '下载 MD')!.click();
  [...document.querySelectorAll('button')].find((button) => button.textContent === '下载 HTML')!.click();
  expect(await downloads[0].text()).toBe('# Edited from the editor');
  expect(await downloads[1].text()).toContain('<p># Edited from the editor</p>');
});

it('HTML export in source mode renders the latest edits without requiring a visible preview', async () => {
  const downloads = await setupDemo();
  [...document.querySelectorAll('button')].find((button) => button.textContent === '源码')!.click();
  await tick();
  (document.querySelector('[data-testid="type-document"]') as HTMLButtonElement).click();
  await tick();
  [...document.querySelectorAll('button')].find((button) => button.textContent === '下载 HTML')!.click();
  // 源码模式导出会即时补一次全量渲染（含 mermaid 加载），jsdom 下耗时数秒，放宽等待窗口。
  await vi.waitFor(() => expect(downloads).toHaveLength(1), { timeout: 20000 });
  const html = await downloads[0].text();
  expect(html).toContain('Edited from the editor');
  expect(html).not.toContain('flowchart LR');
});
