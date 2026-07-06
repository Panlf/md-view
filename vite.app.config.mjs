import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const editionVersions = JSON.parse(readFileSync(new URL('./editionVersions.json', import.meta.url), 'utf8'));

export default defineConfig(({ mode }) => {
  const edition = process.env.VITE_MD_VIEW_EDITION === 'plus' || mode === 'plus' ? 'plus' : 'lite';
  process.env.VITE_MD_VIEW_EDITION = edition;
  process.env.VITE_MD_VIEW_VERSION = editionVersions[edition];
  const rendererEntry = fileURLToPath(new URL(`./src/markdown/renderers/${edition}-entry.ts`, import.meta.url));

  return {
    plugins: [svelte({ configFile: './svelte.config.js' })],
    resolve: {
      alias: {
        '#markdown-renderer': rendererEntry
      }
    },
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
      sourcemap: false
    }
  };
});
