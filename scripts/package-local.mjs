#!/usr/bin/env node
// 本地打包：一条命令完成「前端构建 + Tauri 构建 + 产物收集到 release/」。
//
// 用法：
//   node scripts/package-local.mjs                    # Plus 版（默认）
//   node scripts/package-local.mjs lite               # Lite 版
//   node scripts/package-local.mjs both               # Lite + Plus 依次打包
//   node scripts/package-local.mjs plus --no-bundle   # 仅便携 exe，跳过 NSIS 安装器
//
// 未识别的参数原样透传给 tauri build（如 --no-bundle、--debug）。

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildScript = join(root, 'scripts', 'tauri-build-edition.mjs');
const releaseDir = join(root, 'release');

const editionMap = { lite: ['lite'], plus: ['plus'], both: ['lite', 'plus'] };
const args = process.argv.slice(2);
const editionKey = args.find((value) => value in editionMap) ?? 'plus';
const passthrough = args.filter((value) => !(value in editionMap));

let failed = false;
for (const edition of editionMap[editionKey]) {
  console.log(`\n===== 打包 ${edition} 版 =====`);
  const result = spawnSync(process.execPath, [buildScript, edition, ...passthrough], {
    cwd: root,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    console.error(`\n${edition} 版打包失败（退出码 ${result.status ?? '信号终止'}）。`);
    failed = true;
    break;
  }
}

if (failed) process.exit(1);

console.log(`\n===== 打包完成，release/ 产物 =====`);
let listed = 0;
for (const name of listArtifacts(releaseDir)) {
  const stats = statSync(join(releaseDir, name));
  console.log(`  ${name}  (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  listed += 1;
}
if (listed === 0) console.log('  （release/ 下没有产物——是否使用了 --no-bundle 且便携 exe 复制被占用？）');

function listArtifacts(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => statSync(join(dir, name)).isFile())
      .sort();
  } catch {
    return [];
  }
}
