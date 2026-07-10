import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const editions = ['lite', 'plus'];
const errors = [];

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const editionVersions = readJson('editionVersions.json');
const releaseVersion = packageJson.version;
const scripts = packageJson.scripts ?? {};

expect(releaseVersion, 'package.json version is required');
expectEqual(scripts.dev, 'npm run dev:plus', 'package.json default dev script');
expectEqual(scripts.build, 'npm run build:plus', 'package.json default build script');
expectEqual(scripts['build:web'], 'vite build --config vite.app.config.mjs --mode web-plus', 'package.json web build script');
expectEqual(scripts['tauri:dev'], 'npm run tauri:dev:plus', 'package.json default tauri:dev script');
expectEqual(scripts['tauri:build'], 'npm run tauri:build:plus', 'package.json default tauri:build script');
expectEqual(packageLock.version, releaseVersion, 'package-lock.json root version');
expectEqual(packageLock.packages?.['']?.version, releaseVersion, 'package-lock.json package version');
expectEqual(readCargoPackageVersion('src-tauri/Cargo.toml'), releaseVersion, 'src-tauri/Cargo.toml package version');
expectEqual(readJson('src-tauri/tauri.conf.json').version, releaseVersion, 'src-tauri/tauri.conf.json version');

const editionKeys = Object.keys(editionVersions).sort();
expectEqual(editionKeys.join(','), editions.join(','), 'editionVersions.json edition keys');

for (const edition of editions) {
  const titleEdition = titleCase(edition);
  const expectedName = `md-view ${titleEdition}`;
  const config = readJson(`src-tauri/tauri.${edition}.conf.json`);

  expectEqual(editionVersions[edition], releaseVersion, `editionVersions.json ${edition} display version`);
  expectEqual(config.version, releaseVersion, `src-tauri/tauri.${edition}.conf.json version`);
  expectEqual(config.productName, expectedName, `${edition} productName`);
  expectEqual(config.app?.windows?.[0]?.title, expectedName, `${edition} window title`);
  expectEqual(config.identifier, `local.markdown.reader.editor.${edition}`, `${edition} identifier`);
  expectEqual(config.build?.beforeDevCommand, `npm run dev:${edition}`, `${edition} beforeDevCommand`);
  expectEqual(config.build?.beforeBuildCommand, `npm run build:${edition}`, `${edition} beforeBuildCommand`);
  expectEqual(
    config.bundle?.fileAssociations?.[0]?.name,
    `${expectedName} Markdown Document`,
    `${edition} file association name`
  );
}

const viteConfig = readText('vite.app.config.mjs');
expectIncludes(viteConfig, 'process.env.VITE_MD_VIEW_VERSION = editionVersions[edition]', 'Vite display version source');
expectIncludes(viteConfig, "mode === 'web-plus'", 'Vite web Plus mode');
expectIncludes(viteConfig, '#edition-app', 'Vite edition app alias');
expectIncludes(viteConfig, "isWebPlus ? 'WebPlusApp'", 'Vite web Plus app selection');

const mainEntry = readText('src/main.ts');
expectIncludes(mainEntry, "import App from '#edition-app'", 'main entry edition app alias');

const liteApp = readText('src/LiteApp.svelte');
expectIncludes(liteApp, "import AppShell from './AppShell.svelte'", 'Lite app shell composition');
expectExcludes(liteApp, 'PlusSettingsPanel', 'Lite app Plus settings dependency');
expectExcludes(liteApp, 'plusPreferences', 'Lite app Plus preferences dependency');

const plusApp = readText('src/PlusApp.svelte');
expectIncludes(plusApp, 'PlusSettingsPanel', 'Plus app settings panel');
expectIncludes(plusApp, 'defaultPlusPreferences', 'Plus app preferences');
expectIncludes(plusApp, 'indexWorkspaceHeadings', 'Plus app workspace heading index');

const appShell = readText('src/AppShell.svelte');
expectIncludes(appShell, 'class="status-bar"', 'shared bottom status bar');
expectIncludes(appShell, "openToolbarMenu === 'more'", 'shared More menu');
expectIncludes(appShell, 'if (!isTauri()) return;', 'browser-safe app shell mount');
expectExcludes(appShell, '📂', 'shared toolbar emoji icons');

const appCss = readText('src/app.css');
expectIncludes(appCss, 'grid-template-rows: 48px minmax(0, 1fr) 24px;', 'shell command and status rows');

const webPlusApp = readText('src/WebPlusApp.svelte');
expectIncludes(webPlusApp, 'MarkdownEditor', 'Web Plus editor');
expectIncludes(webPlusApp, 'MarkdownPreview', 'Web Plus preview');
expectIncludes(webPlusApp, 'downloadMarkdown', 'Web Plus Markdown download');
expectExcludes(webPlusApp, "from './tauri'", 'Web Plus Tauri dependency');

const editionModule = readText('src/edition.ts');
expectIncludes(editionModule, 'import.meta.env.VITE_MD_VIEW_VERSION', 'UI display version environment');
expectIncludes(editionModule, "isPlusEdition ? 'md-view Plus' : 'md-view Lite'", 'UI edition display names');

const buildScript = readText('scripts/tauri-build-edition.mjs');
expectIncludes(buildScript, 'overlay.version = versions[edition]', 'Tauri build version overlay');
expectIncludes(buildScript, 'const editionPrefix = `md-view-${edition}`', 'Edition artifact prefix');
expectIncludes(buildScript, 'const editionName = `${editionPrefix}_${overlay.version}_${suffix}`', 'Edition bundle artifact naming');

const workflow = readText('.github/workflows/build.yml');
const pullRequestSection = yamlSection(workflow, 'pull_request:');
expectIncludes(pullRequestSection, '- plus', 'CI pull_request plus branch');
expectIncludes(workflow, 'edition: lite', 'CI Lite edition matrix');
expectIncludes(workflow, 'edition: plus', 'CI Plus edition matrix');
expectIncludes(workflow, 'tauri:build:${{ matrix.edition }}', 'CI edition build command');
expectIncludes(workflow, 'md-view-${{ matrix.edition }}-${{ steps.edition-version.outputs.version }}-${{ matrix.platform }}', 'CI artifact name');

const pagesWorkflow = readText('.github/workflows/pages.yml');
expectIncludes(pagesWorkflow, 'npm run build:web', 'Pages web build command');
expectIncludes(pagesWorkflow, 'actions/deploy-pages', 'Pages deploy action');

if (errors.length > 0) {
  console.error('Edition consistency check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Edition consistency check passed for ${editions.join(', ')} ${releaseVersion}.`);

function readText(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function readCargoPackageVersion(path) {
  let inPackageSection = false;

  for (const line of readText(path).split(/\r?\n/)) {
    if (/^\s*\[.+\]\s*$/.test(line)) {
      inPackageSection = line.trim() === '[package]';
      continue;
    }

    if (inPackageSection) {
      const match = line.match(/^\s*version\s*=\s*"([^"]+)"/);

      if (match) {
        return match[1];
      }
    }
  }

  return undefined;
}

function titleCase(value) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function yamlSection(text, header) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === header);

  if (start === -1) {
    return '';
  }

  const indent = leadingSpaces(lines[start]);
  const section = [lines[start]];

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.trim() && leadingSpaces(line) <= indent) {
      break;
    }

    section.push(line);
  }

  return section.join('\n');
}

function leadingSpaces(value) {
  return value.match(/^ */)?.[0].length ?? 0;
}

function expect(condition, label) {
  if (!condition) {
    errors.push(label);
  }
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) {
    errors.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectIncludes(actual, expected, label) {
  if (!actual.includes(expected)) {
    errors.push(`${label}: missing ${JSON.stringify(expected)}`);
  }
}

function expectExcludes(actual, expected, label) {
  if (actual.includes(expected)) {
    errors.push(`${label}: unexpected ${JSON.stringify(expected)}`);
  }
}
