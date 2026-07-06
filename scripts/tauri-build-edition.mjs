import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const edition = process.argv[2];
const buildArgs = process.argv.slice(3);

if (!['lite', 'plus'].includes(edition)) {
  console.error('Usage: node scripts/tauri-build-edition.mjs <lite|plus> [tauri build args]');
  process.exit(1);
}

const versions = JSON.parse(readFileSync(join(root, 'editionVersions.json'), 'utf8'));
const overlayPath = join(root, 'src-tauri', `tauri.${edition}.conf.json`);
const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'));

overlay.version = versions[edition];

const generatedDir = join(root, '.tauri-edition');
mkdirSync(generatedDir, { recursive: true });
const generatedPath = join(generatedDir, `tauri.${edition}.conf.json`);
writeFileSync(generatedPath, `${JSON.stringify(overlay, null, 2)}\n`);

const tauriBin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tauri.cmd' : 'tauri');
const tauriBuildArgs = buildArgs.length > 0 ? buildArgs : ['--bundles', 'nsis'];
const buildStartedAt = Date.now();
const result = spawnSync(tauriBin, ['build', ...tauriBuildArgs, '--config', generatedPath], {
  cwd: root,
  shell: process.platform === 'win32',
  stdio: 'inherit'
});

if (result.error) {
  console.error(result.error);
}

if (result.status === 0) {
  const releaseDir = join(root, 'src-tauri', 'target', 'release');
  const sourceExe = join(releaseDir, 'md-view.exe');
  const editionExe = join(releaseDir, `md-view-${edition}.exe`);

  if (existsSync(sourceExe)) {
    copyFileSync(sourceExe, editionExe);
    console.log(`Edition exe copied to: ${editionExe}`);
  }

  copyEditionBundleArtifacts(releaseDir, edition, overlay, buildStartedAt);
}

process.exit(result.status ?? 1);

function copyEditionBundleArtifacts(releaseDir, edition, overlay, buildStartedAt) {
  const bundleDir = join(releaseDir, 'bundle');
  if (!existsSync(bundleDir)) {
    return;
  }

  const bundleExtensions = new Set(['.AppImage', '.deb', '.dmg', '.exe', '.rpm']);
  const productPrefix = `${overlay.productName}_${overlay.version}_`;
  const editionPrefix = `md-view-${edition}`;

  for (const filePath of listFiles(bundleDir)) {
    const fileName = basename(filePath);
    if (
      fileName.startsWith(editionPrefix) ||
      !bundleExtensions.has(extname(fileName)) ||
      !fileName.startsWith(productPrefix)
    ) {
      continue;
    }

    const stats = statSync(filePath);
    if (stats.mtimeMs + 5000 < buildStartedAt) {
      continue;
    }

    const suffix = fileName.slice(productPrefix.length);
    const editionName = `${editionPrefix}_${overlay.version}_${suffix}`;
    const editionPath = join(dirname(filePath), editionName);

    if (editionPath !== filePath) {
      copyFileSync(filePath, editionPath);
      console.log(`Edition bundle copied to: ${editionPath}`);
    }
  }
}

function listFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}
