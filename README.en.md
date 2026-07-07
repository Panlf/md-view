# md-view

[中文](README.md)

md-view is a local Markdown reader and editor built with Tauri 2, Svelte, and Vite. It is designed for users who want a lightweight local Markdown tool that can be downloaded, modified, and rebuilt easily.

## Highlights

- Lightweight: the Windows installer is about 1.3 MB, and the Windows exe is about 2.9 MB.
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

- Plus is the main development baseline. New features go to Plus by default, the `plus` branch is the primary development branch, and routine validation prioritizes Plus.
- Lite stays compact. Lite only receives bug fixes, compatibility fixes, and explicitly requested small lightweight features; it should not pull in Plus dependencies for full Markdown rendering, export, indexing, or advanced reading settings by default.
- Default development and packaging commands target Plus. Use explicit `:*:lite` commands when working on Lite.

## Local Development

Install these first:

- Node.js 20+
- Rust stable
- The Tauri desktop dependencies required by your operating system

Run:

```bash
npm install
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

On Windows, the default local build uses NSIS to avoid downloading WiX for the `all` target. To try every bundle target supported by the current system, run:

```bash
npm run tauri:build:all
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

The repository includes `.github/workflows/build.yml`:

- Builds all platforms on pushes to `plus` / `main` / `master`
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
