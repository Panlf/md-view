# md-view

[中文](README.md)

md-view is a local Markdown reader and editor built with Tauri 2, Svelte, and Vite. It is designed for users who want a lightweight local Markdown tool that can be downloaded, modified, and rebuilt easily.

[Product website](https://t-meow.github.io/md-view/) · [Online demo](https://t-meow.github.io/md-view/play/) · [Public downloads](https://github.com/T-meow/md-view/releases/latest)

## Development version

This branch contains an unreleased desktop refactor. Public downloads follow their Release notes.

- Opening a file reads only that document. Folder browsing loads direct children on demand and renders only visible rows.
- Tabs keep independent content, source undo history, view modes and reading positions. `Ctrl+P` searches open, recent and loaded files before an explicit workspace indexing action.
- Shared Lite/Plus file management: create files and folders, Save As, rename, move, trash, copy paths and reveal files.
- Manual saves and automatic drafts are the default. Optional write-back is off. Snapshot saves check disk conflicts, replace files atomically and preserve supported encoding, BOM and line endings.
- Ignore rules include `.gitignore`, `.ignore` and custom exclusions. Links and junctions are not traversed. Scans stop at 100,000 entries or 30 seconds; files over 2 MiB open in source mode.

Shortcuts: `Ctrl+N`, `Ctrl+O`, `Ctrl+P`, `Ctrl+S`, `Ctrl+Shift+S`, `Ctrl+W`, `Ctrl+Tab` / `Ctrl+Shift+Tab`. The corresponding Command combinations work on macOS.

See the [development record](docs/load-performance-plan.md) for architecture, interfaces and validation.

## Highlights

- Lightweight: uses the system WebView; Lite keeps essential rendering. Download sizes depend on the release.
- Small app size: easy to download, package, copy, and run locally.
- Outline panel: extracts headings automatically and supports quick navigation.
- Multiple views: read mode, source editing, visual editing, and split preview.
- Appearance options: built-in themes and custom reader background images.
- Local-first: opens local `.md` / `.markdown` files or folders without a cloud service.

![md-view preview](assets/preview.png)

## Features

- Open local Markdown files or folders
- Browse files with a file tree
- Source editing, reading preview, visual editing, and split preview
- Jump through the heading outline
- Draft saving
- Save conflict detection
- Support for `.md` and `.markdown`
- Theme switching and reader background images
- Windows default-app settings entry

## Edition Development Strategy

md-view is maintained as two editions: Lite and Plus.

- `main` maintains the shared desktop UI and file capabilities. Plus is the advanced rendering baseline.
- Lite and Plus share sessions, file management, drafts, folder browsing and filename search. Workspace heading search, advanced rendering, HTML export and advanced reading settings belong to Plus.
- Default development and packaging commands target Plus. Use explicit `:*:lite` commands when working on Lite.

## Local Development

Install these first:

- Node.js 24 LTS (used by CI)
- Rust stable, at least 1.88 to match the locked dependencies
- The Tauri desktop dependencies required by your operating system

Run:

```bash
npm ci --registry=https://registry.npmmirror.com/
npm run tauri:dev
```

By default, `npm run tauri:dev` starts Plus. For Lite development, run:

```bash
npm run tauri:dev:lite
```

## Local Packaging

```bash
npm install
npm run tauri:build
```

By default, `npm run tauri:build` packages Plus. Common edition commands:

```bash
npm run tauri:build:plus
npm run tauri:build:lite
npm run tauri:build:both
```

Build artifacts are written to:

```text
src-tauri/target/release/bundle/
```

The edition build scripts also copy normalized installers and portable executables to the root `release/` directory for local distribution and CI uploads.

The current configuration builds the package types supported by the current system:

- Windows: NSIS installer
- macOS: DMG
- Linux: AppImage, DEB, RPM

These are build targets, not a promise of public binaries for every platform. Public `v1.0.1` offers Windows x64 portable apps and macOS Apple Silicon DMGs.

On Windows, the default local build uses NSIS to avoid downloading WiX for the `all` target. To try every bundle target supported by the current system, run:

```bash
npm run tauri:build:all
```

## Website and online demo

`site/` contains the independent Chinese and English product pages. The homepage does not import editor dependencies; the Svelte demo lives at `/md-view/play/`.

```bash
npm run build:web
npm run check:web
```

Desktop frontend output is `dist/`. The demo builds to `dist-play/`; the combined Pages artifact is `dist-site/`. `VITE_BASE_PATH` overrides the default `/md-view/` prefix. Product copy describes publicly released features only.

## Development checks

```bash
npm run check
npm test
npm run check:editions
npm run build:lite
npm run build:plus
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

## Linux Dependencies

Ubuntu/Debian usually needs:

```bash
sudo apt-get update
sudo apt-get install -y build-essential curl wget file libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf rpm
```

For other distributions, install the corresponding Tauri 2 Linux dependencies.

## macOS Note

This project does not perform Apple signing or notarization by default. If you package and share it directly, macOS may block the unsigned app with Gatekeeper. Add a developer certificate, signing, and notarization before formal public distribution.

## GitHub Actions

`.github/workflows/pages.yml` checks the site and demo on PRs to `main`. It deploys Pages only on `main` updates or manual runs against `main`.

The desktop workflow `.github/workflows/build.yml`:

- Builds Windows and macOS on pushes to `plus` / `main` / `master`
- Runs build checks for pull requests to `plus` / `main` / `master`
- Covers both Lite and Plus in the build matrix, with edition and version included in uploaded artifact names
- Supports manual workflow runs
- Creates a draft Release and uploads build artifacts when a `v*` tag is pushed

Example:

```bash
git tag v0.2.4
git push origin v0.2.4
```

## Contributions

Pull requests are not accepted. Fork this repository and use an AI coding agent or local editor to make, package, and distribute your own changes.

## License and Disclaimer

This project uses WTFPL v2. In short: do what you want with it.

Disclaimer: this project is provided as is, without any express or implied warranty. The author does not guarantee that it is suitable for any particular purpose and is not responsible for any issues, losses, or liability caused by using, modifying, packaging, distributing, or running this project. Use it at your own risk.
