# md-view

[中文](README.md)

md-view is a local Markdown reader and editor built with Tauri 2, Svelte 5, and Vite. It is designed for users who want a lightweight local Markdown tool that can be downloaded, modified, and rebuilt easily.

> This project is developed and maintained based on [T-meow/md-view](https://github.com/T-meow/md-view). Thanks to the original author. Licensed under WTFPL v2.

[Product website](https://t-meow.github.io/md-view/) · [Online demo](https://t-meow.github.io/md-view/play/) · [Public downloads](https://github.com/T-meow/md-view/releases/latest)

![md-view preview](assets/preview.png)

## Highlights

- **Lightweight & local**: uses the system WebView, no cloud dependency; easy to download, package, copy, and run locally.
- **On-demand loading**: opening a file reads only that document; folders load level by level, and large lists render visible rows only.
- **Multi-tab sessions**: keep content, source undo history, view modes, and reading positions.
- **Multiple views**: read mode, source editing (CodeMirror), visual editing, and split preview.
- **Outline navigation**: extracts headings automatically and supports quick jumps.
- **Appearance**: built-in light/dark themes and optional reader background images.
- **File management**: create, Save As, rename, move, trash, copy path, and reveal in system.
- **Safe saves**: version snapshots, conflict checks, and atomic replace; preserves UTF-8 / GBK / UTF-16, BOM, and line endings.

## Features

| Category | Details |
| --- | --- |
| Open | Local `.md` / `.markdown` files or folders |
| Edit | Source editing, visual editing, split preview |
| Preview | GFM, code highlighting, tables, math, Mermaid (Plus) |
| Outline | Heading extraction and jump (`Ctrl+P` heading search, Plus) |
| Drafts | Automatic draft recovery; auto write-back off by default |
| Save | Conflict detection, Save As, encoding/line-ending preserve |
| Search | Open / recent / loaded files; workspace index on demand |
| Themes | Built-in themes, reader background, immersive mode |
| Export | HTML export (Plus) |

### Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+N` | New document |
| `Ctrl+O` | Open file |
| `Ctrl+P` | Quick open |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+W` | Close tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Switch tab |
| `F11` | Immersive mode |

Command combinations work on macOS.

### Scan and safety boundaries

- Links and junctions are not traversed by default.
- Honors `.gitignore`, `.ignore`, and custom exclusions.
- Scan budget: 100,000 entries / 30 seconds.
- Documents larger than 2 MiB open in source mode by default.

See the [development record](docs/load-performance-plan.md) for architecture, interfaces, and validation.

## Edition Strategy

md-view is maintained as two editions: **Lite** and **Plus**.

| | Lite | Plus |
| --- | --- | --- |
| Sessions / file management / drafts / folder browse | ✓ | ✓ |
| Filename search | ✓ | ✓ |
| Advanced rendering (math, Mermaid, GFM extras) | — | ✓ |
| Workspace heading index | — | ✓ |
| HTML export / advanced reading settings | — | ✓ |

- `main` maintains the shared desktop UI and file capabilities. Plus is the advanced rendering baseline.
- Default development and packaging commands target Plus; use explicit `:*:lite` commands for Lite.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Tauri 2 (Rust) |
| Frontend | Svelte 5 + TypeScript + Vite |
| Source editor | CodeMirror 6 |
| Lite rendering | marked |
| Plus rendering | unified / remark / rehype, KaTeX, highlight.js, Mermaid |
| Tests | Vitest, Rust `cargo test` |
| Type check | `svelte-check` |

## Project Structure

```text
src/
  state/          # document sessions, workspace, search, drafts, preferences
  components/     # editor, preview, file tree, tabs, and other UI
  markdown/       # render pipeline (fast / lite / plus) and shared helpers
  AppShell.svelte # desktop shell
src-tauri/        # Rust backend (files, scan, watch, drafts)
site/             # product website sources
tests/            # end-to-end and regression tests
docs/             # development notes and syntax samples
```

## Local Development

Install these first:

- Node.js 24 LTS (used by CI)
- Rust stable ≥ 1.88 to match the locked dependencies
- The Tauri desktop dependencies required by your OS

```bash
npm ci --registry=https://registry.npmmirror.com/
npm run tauri:dev        # Plus
npm run tauri:dev:lite   # Lite
```

Frontend-only debugging (without Tauri):

```bash
npm run dev:plus
npm run dev:lite
```

## Local Packaging

```bash
npm install
npm run tauri:build          # defaults to Plus
npm run tauri:build:plus
npm run tauri:build:lite
npm run tauri:build:both     # both editions
```

Artifacts:

```text
src-tauri/target/release/bundle/
release/   # normalized installers and portable executables
```

The current configuration builds package types supported by the current system:

- Windows: NSIS installer
- macOS: DMG
- Linux: AppImage, DEB, RPM

These are build capabilities, not a promise of public binaries for every platform. Public downloads follow [Releases](https://github.com/T-meow/md-view/releases/latest).

On Windows, local builds use NSIS by default. To try every bundle target supported by the current system:

```bash
npm run tauri:build:all
```

## Website and Online Demo

`site/` contains independent Chinese and English product pages that do not load the editor. The Svelte demo lives at `/md-view/play/`.

```bash
npm run build:web
npm run check:web
```

| Directory | Purpose |
| --- | --- |
| `dist/` | Desktop frontend |
| `dist-play/` | Online demo intermediate output |
| `dist-site/` | Combined Pages artifact |

Default path prefix is `/md-view/`; override with `VITE_BASE_PATH`.

## Development Checks

```bash
npm run check              # svelte-check
npm test                   # Vitest
npm run check:editions
npm run build:lite
npm run build:plus
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

## Platform Dependencies

### Linux

Ubuntu/Debian usually needs:

```bash
sudo apt-get update
sudo apt-get install -y build-essential curl wget file \
  libwebkit2gtk-4.1-dev libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf rpm
```

For other distributions, install the corresponding Tauri 2 Linux dependencies.

### macOS

This project does not perform Apple signing or notarization by default. If you package and share it directly, macOS may block the unsigned app with Gatekeeper. Add a developer certificate, signing, and notarization before formal public distribution.

## GitHub Actions

- `.github/workflows/pages.yml`: builds the site and demo on PRs to `main` and checks routes; deploys Pages only on `main` updates or manual runs.
- `.github/workflows/build.yml`:
  - Builds Windows and macOS on pushes to `plus` / `main` / `master`
  - Runs build checks on pull requests
  - Covers Lite and Plus in the matrix; artifact names include edition and version
  - Creates a draft Release and uploads artifacts when a `v*` tag is pushed

```bash
git tag v1.1.0
git push origin v1.1.0
```

## Contributions

Pull requests are not accepted. Fork this repository and use an AI coding agent or local editor to make, package, and distribute your own changes.

## License and Disclaimer

This project uses [WTFPL v2](./LICENSE). In short: do what you want with it.

Original project copyright is recorded in the repository [LICENSE](./LICENSE) and upstream [T-meow/md-view](https://github.com/T-meow/md-view).

Disclaimer: this project is provided as is, without any express or implied warranty. The author does not guarantee that it is suitable for any particular purpose and is not responsible for any issues, losses, or liability caused by using, modifying, packaging, distributing, or running this project. Use it at your own risk.
