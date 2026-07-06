<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { plusMarkdownStatus } from '../edition';
  import { renderMarkdown } from '#markdown-renderer';
  import { defaultPlusPreferences, type PlusPreferences } from '../plusPreferences';
  import { openExternalUrl, validateLocalLinks } from '../tauri';
  import type { Heading, LinkValidationResult } from '../types';

  export let content = '';
  export let outline: Heading[] = [];
  export let filePath = '';
  export let preferences: PlusPreferences = defaultPlusPreferences;

  const dispatch = createEventDispatcher<{
    activeLine: number;
    openLocalFile: string;
    renderHtml: string;
    renderStatus: string;
    linkStatus: { broken: number; total: number };
  }>();
  let html = '';
  let previewHost: HTMLElement;
  let renderToken = 0;
  let activeObserver: IntersectionObserver | undefined;
  let imageOverlay: { src: string; source: string; scale: number } | null = null;

  onMount(() => {
    previewHost.addEventListener('click', handleClick);
    return () => {
      previewHost.removeEventListener('click', handleClick);
      activeObserver?.disconnect();
    };
  });

  $: void renderPreview(content, outline, filePath, preferences);

  async function renderPreview(source: string, headings: Heading[], markdownPath: string, prefs: PlusPreferences) {
    const token = ++renderToken;
    try {
      const result = await renderMarkdown(source, headings, markdownPath, prefs);
      if (token !== renderToken) return;
      html = result.html;
      dispatch('renderStatus', result.status);
      dispatch('renderHtml', result.html);
      await tickAfterHtml();
      observeHeadings();
      if (prefs.validateLocalLinks && result.linkTargets?.length) {
        const validation = await validateLocalLinks(markdownPath, result.linkTargets);
        if (token === renderToken) {
          applyLinkValidation(validation);
        }
      } else {
        dispatch('linkStatus', { broken: 0, total: 0 });
      }
    } catch (error) {
      if (token !== renderToken) return;
      html = `<pre class="markdown-render-error">${escapeHtml(String(error))}</pre>`;
      dispatch('renderStatus', plusMarkdownStatus);
      dispatch('renderHtml', html);
    }
  }

  export function scrollToLine(line: number) {
    const target = previewHost?.querySelector(`[data-outline-line="${line}"]`);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    const action = target?.closest('[data-mermaid-action]');
    if (action instanceof HTMLButtonElement) {
      event.preventDefault();
      handleMermaidAction(action);
      return;
    }

    const codeAction = target?.closest('[data-code-action]');
    if (codeAction instanceof HTMLButtonElement) {
      event.preventDefault();
      handleCodeAction(codeAction);
      return;
    }

    const image = target?.closest('img');
    if (image instanceof HTMLImageElement) {
      event.preventDefault();
      imageOverlay = { src: image.currentSrc || image.src, source: image.dataset.sourceSrc ?? image.getAttribute('src') ?? '', scale: 1 };
      return;
    }

    const externalLink = target?.closest('a[href]');
    if (externalLink instanceof HTMLAnchorElement && isExternalUrl(externalLink.href)) {
      event.preventDefault();
      void openExternalUrl(externalLink.href);
      return;
    }

    const anchorLink = target?.closest('a[data-local-anchor]');
    if (anchorLink instanceof HTMLAnchorElement) {
      event.preventDefault();
      scrollToAnchor(anchorLink.dataset.localAnchor ?? '');
      return;
    }

    const link = target?.closest('a[data-local-file]');
    if (!(link instanceof HTMLAnchorElement)) return;
    const localFile = link.dataset.localFile;
    if (!localFile) return;
    event.preventDefault();
    dispatch('openLocalFile', localFile);
  }

  function scrollToAnchor(anchor: string) {
    if (!anchor) return;
    const target = previewHost?.querySelector(`#${CSS.escape(anchor)}, [name="${CSS.escape(anchor)}"]`);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function observeHeadings() {
    activeObserver?.disconnect();
    if (!preferences.syncScroll || !previewHost) return;
    const headings = Array.from(previewHost.querySelectorAll<HTMLElement>('[data-outline-line]'));
    activeObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        const line = Number((visible?.target as HTMLElement | undefined)?.dataset.outlineLine);
        if (line) dispatch('activeLine', line);
      },
      { root: previewHost, rootMargin: '-8% 0px -72% 0px', threshold: [0, 1] }
    );
    headings.forEach((heading) => activeObserver?.observe(heading));
  }

  function applyLinkValidation(results: LinkValidationResult[]) {
    const broken = results.filter((result) => !result.ok);
    for (const result of results) {
      if (result.ok) continue;
      const nodes = result.kind === 'image'
        ? Array.from(previewHost?.querySelectorAll<HTMLElement>('img[data-source-src]') ?? []).filter((node) => node.dataset.sourceSrc === result.href)
        : Array.from(previewHost?.querySelectorAll<HTMLElement>('a') ?? []).filter(
            (node) => node.dataset.sourceHref === result.href || node.getAttribute('href') === result.href
          );
      nodes.forEach((node) => {
        node.classList.add('markdown-broken-link');
        node.title = result.message ?? 'Local target not found';
      });
    }
    dispatch('linkStatus', { broken: broken.length, total: results.length });
  }

  function handleMermaidAction(button: HTMLButtonElement) {
    const wrapper = button.closest<HTMLElement>('.markdown-mermaid');
    if (!wrapper) return;
    const action = button.dataset.mermaidAction;
    const current = Number(wrapper.dataset.mermaidScale ?? '1') || 1;
    const next = action === 'zoom-in' ? current + 0.15 : action === 'zoom-out' ? current - 0.15 : action === 'reset' || action === 'fit' ? 1 : current;
    if (action === 'copy-source') {
      void navigator.clipboard?.writeText(wrapper.dataset.mermaidSource ?? button.parentElement?.dataset.mermaidSource ?? '');
      return;
    }
    wrapper.dataset.mermaidScale = String(Math.max(0.45, Math.min(2.4, next)));
    wrapper.classList.toggle('fit-width', action === 'fit');
    const svg = wrapper.querySelector<SVGElement>('svg');
    if (svg) {
      svg.style.transform = `scale(${wrapper.dataset.mermaidScale})`;
      svg.style.transformOrigin = 'top center';
    }
  }

  function handleCodeAction(button: HTMLButtonElement) {
    const pre = button.closest<HTMLElement>('pre');
    if (!pre) return;
    if (button.dataset.codeAction === 'copy') {
      void navigator.clipboard?.writeText(pre.dataset.sourceCode ?? pre.textContent ?? '');
      return;
    }
    if (button.dataset.codeAction === 'wrap') {
      pre.classList.toggle('code-wrap');
    }
  }

  function closeImageOverlay() {
    imageOverlay = null;
  }

  function zoomImage(delta: number) {
    if (!imageOverlay) return;
    imageOverlay = { ...imageOverlay, scale: Math.max(0.35, Math.min(3, imageOverlay.scale + delta)) };
  }

  function isExternalUrl(url: string) {
    return /^(?:https?:|mailto:|tel:)/i.test(url);
  }

  async function tickAfterHtml() {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function escapeHtml(value: string) {
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
</script>

<article bind:this={previewHost} class="markdown-preview">
  {@html html}
</article>

{#if imageOverlay}
  <div class="image-preview-backdrop" role="presentation" on:click={closeImageOverlay}></div>
  <div class="image-preview-dialog" role="dialog" aria-label="Image preview">
    <div class="image-preview-toolbar">
      <span title={imageOverlay.source}>{imageOverlay.source}</span>
      <button type="button" on:click={() => zoomImage(-0.15)}>缩小</button>
      <button type="button" on:click={() => zoomImage(0.15)}>放大</button>
      <button type="button" on:click={() => void navigator.clipboard?.writeText(imageOverlay?.source ?? '')}>复制路径</button>
      <button type="button" on:click={closeImageOverlay}>关闭</button>
    </div>
    <div class="image-preview-stage">
      <img src={imageOverlay.src} alt="" style={`transform: scale(${imageOverlay.scale})`} />
    </div>
  </div>
{/if}
