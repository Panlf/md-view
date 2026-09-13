import type { LinkValidationRequest, LinkValidationResult } from './types';

export const runtimeTarget = import.meta.env.VITE_MD_VIEW_TARGET === 'web' ? 'web' : 'desktop';
export const isWebRuntime = runtimeTarget === 'web';

export async function openExternalUrl(url: string): Promise<void> {
  if (isWebRuntime) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const { openExternalUrl: tauriOpenExternalUrl } = await import('./api');
  return tauriOpenExternalUrl(url);
}

export async function validateLocalLinks(
  path: string,
  links: LinkValidationRequest[],
  anchors: string[] = []
): Promise<LinkValidationResult[]> {
  if (isWebRuntime) {
    return links.map((link) => ({
      href: link.href,
      kind: link.kind,
      ok: true
    }));
  }

  const { validateLocalLinks: tauriValidateLocalLinks } = await import('./api');
  return tauriValidateLocalLinks(path, links, anchors);
}
