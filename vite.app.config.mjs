import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const editionVersions = JSON.parse(readFileSync(new URL('./editionVersions.json', import.meta.url), 'utf8'));

export default defineConfig(({ mode }) => {
  const isWebPlus = mode === 'web-plus';
  const edition = process.env.VITE_MD_VIEW_EDITION === 'plus' || mode === 'plus' || isWebPlus ? 'plus' : 'lite';
  process.env.VITE_MD_VIEW_EDITION = edition;
  process.env.VITE_MD_VIEW_VERSION = editionVersions[edition];
  process.env.VITE_MD_VIEW_TARGET = isWebPlus ? 'web' : 'desktop';
  const rendererEntry = fileURLToPath(new URL(`./src/markdown/renderers/${edition}-entry.ts`, import.meta.url));
  const editionAppName = isWebPlus ? 'WebPlusApp' : edition === 'plus' ? 'PlusApp' : 'LiteApp';
  const editionAppEntry = fileURLToPath(new URL(`./src/${editionAppName}.svelte`, import.meta.url));
  const runtimeBridgeEntry = fileURLToPath(
    new URL(`./src/runtime.${isWebPlus ? 'web' : 'desktop'}.ts`, import.meta.url)
  );

  return {
    plugins: [svelte({ configFile: './svelte.config.js' })],
    resolve: {
      alias: {
        '#edition-app': editionAppEntry,
        '#markdown-renderer': rendererEntry,
        '#runtime-bridge': runtimeBridgeEntry
      }
    },
    base: process.env.VITE_BASE_PATH ?? './',
    clearScreen: false,
    server: {
      host: '127.0.0.1',
      port: 1420,
      strictPort: true,
      watch: {
        ignored: ['**/src-tauri/**']
      }
    },
    build: {
      target: 'es2020',
      minify: 'esbuild',
      sourcemap: false,
      // mermaid 按图表类型懒加载，单块超 500KB 属预期（不影响首屏），关闭该提示。
      chunkSizeWarningLimit: 1500
    }
  };
});
