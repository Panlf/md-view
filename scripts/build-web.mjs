import { cp, mkdir, rm, realpath, lstat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const base = `/${(process.env.VITE_BASE_PATH || '/md-view/').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
function run(args, env = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run(['scripts/build-site.mjs'], { VITE_BASE_PATH: base });
run(
  [
    'node_modules/vite/bin/vite.js',
    'build',
    '--config',
    'vite.app.config.mjs',
    '--mode',
    'web-plus',
    '--outDir',
    'dist-play'
  ],
  { VITE_BASE_PATH: `${base}play/` }
);
// Only this known build output is replaced; source files and desktop output are separate.
const play = resolve(root, 'dist-site/play');
const realRoot = await realpath(root);
const realSite = await realpath(resolve(root, 'dist-site'));
const siteRelative = relative(realRoot, realSite);
if (!siteRelative || siteRelative.startsWith('..') || isAbsolute(siteRelative))
  throw new Error('Pages output must stay inside this project');
const previous = await lstat(play).catch((error) => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
if (previous?.isSymbolicLink() || (previous && relative(realSite, await realpath(play)) !== 'play'))
  throw new Error('Refusing to replace a linked Pages output');
await rm(play, { recursive: true, force: true });
await mkdir(play, { recursive: true });
await cp(resolve(root, 'dist-play'), play, { recursive: true });
console.log('Pages output assembled: dist-site/ (home, en/, play/)');
