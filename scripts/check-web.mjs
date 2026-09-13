import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
const root = fileURLToPath(new URL('../dist-site/', import.meta.url));
const errors = [];
for (const file of ['index.html', 'en/index.html', 'play/index.html']) {
  const html = await readFile(resolve(root, file), 'utf8');
  const dom = new JSDOM(html, { url: `https://t-meow.github.io/md-view/${file}` });
  const document = dom.window.document;
  if (!document.title) errors.push(`${file}: missing title`);
  for (const element of document.querySelectorAll('[href],[src]')) {
    const source = element.getAttribute('href') || element.getAttribute('src');
    if (!source || source.startsWith('#') || source.startsWith('data:')) continue;
    const url = new URL(source, document.URL);
    if (url.origin !== 'https://t-meow.github.io') continue;
    if (!url.pathname.startsWith('/md-view/')) {
      errors.push(`${file}: wrong base path ${source}`);
      continue;
    }
    const local = url.pathname.slice('/md-view/'.length);
    try {
      await access(resolve(root, local.endsWith('/') ? `${local}index.html` : local));
    } catch {
      errors.push(`${file}: missing local target ${source}`);
    }
  }
  if (file !== 'play/index.html') {
    if (
      !document.querySelector('meta[name="description"]') ||
      !document.querySelector('link[rel="canonical"]')
    )
      errors.push(`${file}: missing SEO metadata`);
    if (document.querySelectorAll('h1').length !== 1) errors.push(`${file}: expected one h1`);
    for (const script of document.querySelectorAll('script[src]'))
      if (!script.src.endsWith('/site.js'))
        errors.push(`${file}: homepage unexpectedly loads application code`);
    if (!document.querySelector('a[href="/md-view/play/"]')) errors.push(`${file}: missing online demo link`);
  }
  dom.window.close();
}
for (const file of ['robots.txt', 'sitemap.xml', '.nojekyll']) await access(resolve(root, file));
if (errors.length) throw new Error(errors.join('\n'));
console.log('Pages routes, assets, metadata and homepage isolation passed.');
