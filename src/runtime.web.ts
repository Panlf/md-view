// Web 运行时桥：浏览器环境的降级实现（web 构建经别名 #runtime-bridge 使用）。
// 链接校验在浏览器无法访问本地文件系统，全部视为通过；外链用新标签打开。
import type { LinkValidationRequest, LinkValidationResult } from './types';

export async function openExternalUrl(url: string): Promise<void> {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function validateLocalLinks(
  _path: string,
  links: LinkValidationRequest[],
  _anchors: string[] = []
): Promise<LinkValidationResult[]> {
  return links.map((link) => ({
    href: link.href,
    kind: link.kind,
    ok: true
  }));
}
