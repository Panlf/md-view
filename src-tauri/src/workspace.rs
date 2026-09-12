use crate::documents::{blocking, canonical, display_path, is_link, read_document, Result};
use ignore::{overrides::OverrideBuilder, WalkBuilder};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::Channel, AppHandle, Emitter, State};

const BATCH_SIZE: usize = 128;
const MAX_ENTRIES: u64 = 100_000;
const MAX_MILLIS: u128 = 30_000;
const MAX_DOCUMENT_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
pub struct Entry {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DirectoryBatch {
    pub request_id: String,
    pub path: String,
    pub entries: Vec<Entry>,
    pub errors: Vec<String>,
    pub complete: bool,
    pub version: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanBatch {
    pub request_id: String,
    pub files: Vec<Entry>,
    pub headings: Vec<crate::WorkspaceHeading>,
    pub scanned: u64,
    pub skipped: u64,
    pub errors: Vec<String>,
    pub elapsed_ms: u64,
    pub complete: bool,
    pub cancelled: bool,
    pub incomplete: bool,
    pub message: Option<String>,
}

type HeadingCache = HashMap<String, (u64, SystemTime, Vec<crate::WorkspaceHeading>)>;
#[derive(Default)]
struct Inner {
    jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
    scan_gate: tauri::async_runtime::Mutex<()>,
    headings: Mutex<HeadingCache>,
    watcher: Mutex<Option<RecommendedWatcher>>,
    watched: Mutex<HashSet<PathBuf>>,
}

#[derive(Clone, Default)]
pub struct WorkspaceState(Arc<Inner>);

fn builder(root: &Path, path: &Path, excludes: &[String], shallow: bool) -> Result<WalkBuilder> {
    let mut overrides = OverrideBuilder::new(root);
    for pattern in excludes {
        let pattern = pattern.trim();
        if !pattern.is_empty() {
            overrides
                .add(&format!("!{}", pattern.trim_start_matches('!')))
                .map_err(|e| format!("无效排除规则 {pattern}: {e}"))?;
        }
    }
    let unity = root.ancestors().any(|ancestor| {
        ancestor
            .join("ProjectSettings/ProjectVersion.txt")
            .is_file()
            && ancestor.join("Assets").is_dir()
    });
    let mut walk = WalkBuilder::new(path);
    walk.hidden(false)
        .git_ignore(true)
        .git_exclude(true)
        .git_global(false)
        .ignore(true)
        .parents(true)
        .require_git(false)
        .follow_links(false)
        .overrides(overrides.build().map_err(|e| e.to_string())?);
    if shallow {
        walk.max_depth(Some(1));
    }
    walk.filter_entry(move |entry| {
        if entry.depth() == 0 {
            return true;
        }
        let name = entry.file_name().to_string_lossy();
        if entry.file_type().is_some_and(|t| t.is_dir()) {
            if matches!(
                name.as_ref(),
                ".git" | ".svn" | ".hg" | "node_modules" | "target" | "dist" | ".svelte-kit"
            ) {
                return false;
            }
            if unity && matches!(name.as_ref(), "Library" | "Temp" | "Obj" | "Logs") {
                return false;
            }
        }
        // Windows junctions may report directory type; inspect reparse metadata before descending.
        !fs::symlink_metadata(entry.path()).is_ok_and(|m| is_link(&m))
    });
    Ok(walk)
}

fn entry(path: &Path, is_dir: bool) -> Result<Option<Entry>> {
    if !is_dir && !crate::is_browsable_text_path(path) {
        return Ok(None);
    }
    Ok(Some(Entry {
        path: display_path(path),
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into(),
        kind: if is_dir { "directory" } else { "file" }.into(),
        size: if is_dir {
            0
        } else {
            fs::metadata(path).map_err(|e| e.to_string())?.len()
        },
    }))
}

fn read_directory(
    root: &Path,
    path: &Path,
    excludes: &[String],
    cancelled: &AtomicBool,
    mut emit: impl FnMut(Vec<Entry>, Vec<String>),
) -> Result<()> {
    let mut entries = Vec::new();
    let mut errors = Vec::new();
    for item in builder(root, path, excludes, true)?.build() {
        #[cfg(test)]
        crate::io_metrics::entry();
        if cancelled.load(Ordering::Relaxed) {
            break;
        }
        match item {
            Ok(item) if item.depth() > 0 => {
                match entry(item.path(), item.file_type().is_some_and(|t| t.is_dir())) {
                    Ok(Some(item)) => entries.push(item),
                    Ok(None) => {}
                    Err(error) => errors.push(error),
                }
            }
            Err(error) => errors.push(error.to_string()),
            _ => {}
        }
        if entries.len() + errors.len() >= BATCH_SIZE {
            emit(std::mem::take(&mut entries), std::mem::take(&mut errors));
        }
    }
    if !entries.is_empty() || !errors.is_empty() {
        emit(entries, errors);
    }
    Ok(())
}

impl WorkspaceState {
    fn job(&self, id: &str) -> Arc<AtomicBool> {
        let cancel = Arc::new(AtomicBool::new(false));
        if let Some(previous) = self
            .0
            .jobs
            .lock()
            .unwrap()
            .insert(id.into(), cancel.clone())
        {
            previous.store(true, Ordering::Relaxed);
        }
        cancel
    }
    fn finish(&self, id: &str, cancel: &Arc<AtomicBool>) {
        let mut jobs = self.0.jobs.lock().unwrap();
        if jobs
            .get(id)
            .is_some_and(|current| Arc::ptr_eq(current, cancel))
        {
            jobs.remove(id);
        }
    }
}

#[tauri::command]
pub async fn directory_load(
    state: State<'_, WorkspaceState>,
    root: String,
    path: String,
    excludes: Vec<String>,
    request_id: String,
    channel: Channel<DirectoryBatch>,
) -> Result<()> {
    let state = state.inner().clone();
    let cancel = state.job(&request_id);
    blocking(move || {
        let result = (|| {
            let root = canonical(Path::new(&root))?;
            let directory = canonical(Path::new(&path))?;
            if !directory.starts_with(&root) {
                return Err("目录不属于当前工作区".into());
            }
            let version = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
                .to_string();
            read_directory(&root, &directory, &excludes, &cancel, |entries, errors| {
                if channel
                    .send(DirectoryBatch {
                        request_id: request_id.clone(),
                        path: path.clone(),
                        entries,
                        errors,
                        complete: false,
                        version: version.clone(),
                    })
                    .is_err()
                {
                    cancel.store(true, Ordering::Relaxed);
                }
            })?;
            if !cancel.load(Ordering::Relaxed) {
                let _ = channel.send(DirectoryBatch {
                    request_id: request_id.clone(),
                    path,
                    entries: vec![],
                    errors: vec![],
                    complete: true,
                    version,
                });
            }
            Ok(())
        })();
        state.finish(&request_id, &cancel);
        result
    })
    .await
}

#[tauri::command]
pub fn scan_cancel(state: State<'_, WorkspaceState>, request_id: String) {
    if let Some(cancel) = state.0.jobs.lock().unwrap().get(&request_id) {
        cancel.store(true, Ordering::Relaxed);
    }
}

// The explicit inputs also let tests inject cancellation, budgets and the result sink.
#[allow(clippy::too_many_arguments)]
fn scan(
    root: &Path,
    kind: &str,
    excludes: &[String],
    request_id: &str,
    cancel: &AtomicBool,
    cache: &Mutex<HeadingCache>,
    limits: (u64, u128),
    mut emit: impl FnMut(ScanBatch) -> bool,
) -> Result<()> {
    let started = Instant::now();
    let mut batch = ScanBatch {
        request_id: request_id.into(),
        files: vec![],
        headings: vec![],
        scanned: 0,
        skipped: 0,
        errors: vec![],
        elapsed_ms: 0,
        complete: false,
        cancelled: false,
        incomplete: false,
        message: None,
    };
    let mut results = 0usize;
    let mut last_emit = Instant::now();
    for item in builder(root, root, excludes, false)?.build() {
        #[cfg(test)]
        crate::io_metrics::entry();
        if cancel.load(Ordering::Relaxed) {
            batch.cancelled = true;
            break;
        }
        if batch.scanned >= limits.0
            || started.elapsed().as_millis() >= limits.1
            || results >= 100_000
        {
            batch.incomplete = true;
            batch.message =
                Some("已达到扫描预算，结果不完整。请缩小目录或调整排除规则后重试。".into());
            break;
        }
        batch.scanned += 1;
        let item = match item {
            Ok(item) => item,
            Err(error) => {
                batch.skipped += 1;
                if batch.errors.len() < 20 {
                    batch.errors.push(error.to_string());
                }
                continue;
            }
        };
        if item.file_type().is_some_and(|t| t.is_file())
            && crate::is_browsable_text_path(item.path())
        {
            let file = match entry(item.path(), false) {
                Ok(file) => file,
                Err(error) => {
                    batch.skipped += 1;
                    if batch.errors.len() < 20 {
                        batch
                            .errors
                            .push(format!("{}: {error}", item.path().display()));
                    }
                    continue;
                }
            };
            if let Some(file) = file {
                if kind == "files" {
                    batch.files.push(file);
                    results += 1;
                } else if crate::is_markdown_path(item.path()) {
                    if file.size > MAX_DOCUMENT_BYTES {
                        batch.skipped += 1;
                        continue;
                    }
                    let metadata = match fs::metadata(item.path()) {
                        Ok(m) => m,
                        Err(error) => {
                            batch.skipped += 1;
                            if batch.errors.len() < 20 {
                                batch
                                    .errors
                                    .push(format!("{}: {error}", item.path().display()));
                            }
                            continue;
                        }
                    };
                    let modified = metadata.modified().unwrap_or(UNIX_EPOCH);
                    let cached = cache
                        .lock()
                        .unwrap()
                        .get(&file.path)
                        .filter(|(size, time, _)| *size == file.size && *time == modified)
                        .map(|(_, _, headings)| headings.clone());
                    let headings = if let Some(headings) = cached {
                        headings
                    } else {
                        if cancel.load(Ordering::Relaxed) {
                            batch.cancelled = true;
                            break;
                        }
                        let document = match read_document(item.path()) {
                            Ok(file) => file,
                            Err(error) => {
                                batch.skipped += 1;
                                if batch.errors.len() < 20 {
                                    batch
                                        .errors
                                        .push(format!("{}: {error}", item.path().display()));
                                }
                                continue;
                            }
                        };
                        let headings: Vec<_> =
                            crate::extract_headings_from_content(&document.content)
                                .into_iter()
                                .map(|h| crate::WorkspaceHeading {
                                    path: file.path.clone(),
                                    file_name: file.name.clone(),
                                    level: h.level,
                                    text: h.text,
                                    line: h.line,
                                    anchor: h.anchor,
                                })
                                .collect();
                        let mut cache = cache.lock().unwrap();
                        if cache.len() >= 512 {
                            cache.clear();
                        }
                        // Bound individual cache entries as well as the number of files.
                        if headings.len() <= 2048 {
                            cache.insert(file.path, (file.size, modified, headings.clone()));
                        }
                        headings
                    };
                    if results + headings.len() > 100_000 {
                        batch.incomplete = true;
                        batch.message =
                            Some("标题数量达到预算，结果不完整。请缩小目录后重试。".into());
                    }
                    for heading in headings {
                        if results >= 100_000 {
                            break;
                        }
                        batch.headings.push(heading);
                        results += 1;
                    }
                }
            }
        }
        if batch.files.len() + batch.headings.len() >= BATCH_SIZE
            || last_emit.elapsed().as_millis() >= 100
        {
            batch.elapsed_ms = started.elapsed().as_millis() as u64;
            if !emit(batch.clone()) {
                return Ok(());
            }
            batch.files.clear();
            batch.headings.clear();
            batch.errors.clear();
            last_emit = Instant::now();
        }
    }
    batch.cancelled |= cancel.load(Ordering::Relaxed);
    batch.complete = true;
    batch.elapsed_ms = started.elapsed().as_millis() as u64;
    emit(batch);
    Ok(())
}

#[tauri::command]
pub async fn workspace_scan(
    state: State<'_, WorkspaceState>,
    root: String,
    kind: String,
    excludes: Vec<String>,
    request_id: String,
    channel: Channel<ScanBatch>,
) -> Result<()> {
    if kind != "files" && kind != "headings" {
        return Err("未知搜索类型".into());
    }
    let state = state.inner().clone();
    let cancel = state.job(&request_id);
    // Queued scans wait asynchronously instead of occupying blocking file I/O workers.
    let gate_state = state.clone();
    let _gate = gate_state.0.scan_gate.lock().await;
    if cancel.load(Ordering::Relaxed) {
        state.finish(&request_id, &cancel);
        return Ok(());
    }
    blocking(move || {
        // Only scans share this gate. Opening and saving never acquire it.
        let result = (|| {
            if cancel.load(Ordering::Relaxed) {
                return Ok(());
            }
            let root = canonical(Path::new(&root))?;
            scan(
                &root,
                &kind,
                &excludes,
                &request_id,
                &cancel,
                &state.0.headings,
                (MAX_ENTRIES, MAX_MILLIS),
                |batch| channel.send(batch).is_ok(),
            )
        })();
        state.finish(&request_id, &cancel);
        result
    })
    .await
}

#[derive(Clone, Serialize)]
struct Changed {
    paths: Vec<String>,
}

#[derive(Serialize)]
pub struct WatchReply {
    available: bool,
    failed: Vec<String>,
}

#[tauri::command]
pub async fn workspace_watch(
    app: AppHandle,
    state: State<'_, WorkspaceState>,
    paths: Vec<String>,
) -> Result<WatchReply> {
    let state = state.inner().clone();
    blocking(move || {
        let mut slot = state.0.watcher.lock().unwrap();
        if slot.is_none() {
            let weak = Arc::downgrade(&state.0);
            match notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
                if let Ok(event) = event {
                    if matches!(event.kind, notify::EventKind::Access(_)) {
                        return;
                    }
                    let paths: Vec<_> = event.paths.iter().map(|p| display_path(p)).collect();
                    if let Some(inner) = weak.upgrade() {
                        let mut cache = inner.headings.lock().unwrap();
                        for path in &paths {
                            cache.remove(path);
                        }
                    }
                    let _ = app.emit("workspace-changed", Changed { paths });
                }
            }) {
                Ok(watcher) => *slot = Some(watcher),
                Err(error) => {
                    return Ok(WatchReply {
                        available: false,
                        failed: vec![error.to_string()],
                    })
                }
            }
        }
        let requested: HashSet<_> = paths
            .iter()
            .filter_map(|p| canonical(Path::new(p)).ok())
            .filter(|p| p.is_dir())
            .collect();
        let mut watched = state.0.watched.lock().unwrap();
        let watcher = slot.as_mut().unwrap();
        for path in watched.difference(&requested).cloned().collect::<Vec<_>>() {
            let _ = watcher.unwatch(&path);
            watched.remove(&path);
        }
        let mut failed = Vec::new();
        for path in requested.difference(&watched).cloned().collect::<Vec<_>>() {
            match watcher.watch(&path, RecursiveMode::NonRecursive) {
                Ok(()) => {
                    watched.insert(path);
                }
                Err(error) => failed.push(format!("{}: {error}", display_path(&path))),
            }
        }
        Ok(WatchReply {
            available: failed.is_empty(),
            failed,
        })
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shallow_listing_honors_ignores_and_does_not_enter_children() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("docs")).unwrap();
        fs::create_dir(dir.path().join("node_modules")).unwrap();
        fs::write(dir.path().join("docs/child.md"), "child").unwrap();
        fs::write(dir.path().join("README.md"), "root").unwrap();
        fs::write(dir.path().join("secret.md"), "secret").unwrap();
        fs::write(dir.path().join(".gitignore"), "secret.md\n").unwrap();
        let mut entries = Vec::new();
        read_directory(
            dir.path(),
            dir.path(),
            &[],
            &AtomicBool::new(false),
            |batch, _| entries.extend(batch),
        )
        .unwrap();
        let names: HashSet<_> = entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, HashSet::from(["docs", "README.md"]));
    }
    #[test]
    fn budget_and_cancel_are_reported() {
        let dir = tempfile::tempdir().unwrap();
        for i in 0..8 {
            fs::write(dir.path().join(format!("{i}.md")), "# Heading").unwrap();
        }
        let mut batches = Vec::new();
        scan(
            dir.path(),
            "headings",
            &[],
            "one",
            &AtomicBool::new(false),
            &Mutex::default(),
            (2, MAX_MILLIS),
            |batch| {
                batches.push(batch);
                true
            },
        )
        .unwrap();
        assert!(batches.last().unwrap().incomplete);
        batches.clear();
        scan(
            dir.path(),
            "files",
            &[],
            "two",
            &AtomicBool::new(true),
            &Mutex::default(),
            (MAX_ENTRIES, MAX_MILLIS),
            |batch| {
                batches.push(batch);
                true
            },
        )
        .unwrap();
        assert!(batches.last().unwrap().cancelled);
        assert_eq!(batches.last().unwrap().scanned, 0);
    }
    #[test]
    fn changed_document_invalidates_heading_cache() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.md");
        let cache = Mutex::default();
        fs::write(&path, "# A").unwrap();
        let mut headings = Vec::new();
        scan(
            dir.path(),
            "headings",
            &[],
            "one",
            &AtomicBool::new(false),
            &cache,
            (MAX_ENTRIES, MAX_MILLIS),
            |b| {
                headings.extend(b.headings);
                true
            },
        )
        .unwrap();
        fs::write(&path, "# Changed").unwrap();
        headings.clear();
        scan(
            dir.path(),
            "headings",
            &[],
            "two",
            &AtomicBool::new(false),
            &cache,
            (MAX_ENTRIES, MAX_MILLIS),
            |b| {
                headings.extend(b.headings);
                true
            },
        )
        .unwrap();
        assert_eq!(headings[0].text, "Changed");
    }
    #[cfg(windows)]
    #[test]
    fn junction_cycle_is_not_followed() {
        use std::os::windows::process::CommandExt;
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("cycle");
        let output = std::process::Command::new("cmd.exe")
            .args(["/d", "/c", "mklink", "/J"])
            .arg(&target)
            .arg(dir.path())
            .creation_flags(0x08000000)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let mut rows = Vec::new();
        read_directory(
            dir.path(),
            dir.path(),
            &[],
            &AtomicBool::new(false),
            |entries, _| rows.extend(entries),
        )
        .unwrap();
        assert!(rows.is_empty());
        fs::remove_dir(&target).unwrap();
    }

    #[test]
    fn unity_exclusions_are_conditional_and_custom_rules_are_shared() {
        let dir = tempfile::tempdir().unwrap();
        for name in ["Library", "Assets", "docs", "excluded"] {
            fs::create_dir(dir.path().join(name)).unwrap();
        }
        fs::write(dir.path().join(".ignore"), "excluded/\n").unwrap();
        fs::write(dir.path().join("docs/private.md"), "# Private").unwrap();
        let excludes = vec!["docs/private.md".into()];
        let list = || {
            let mut rows = Vec::new();
            read_directory(
                dir.path(),
                dir.path(),
                &excludes,
                &AtomicBool::new(false),
                |entries, _| rows.extend(entries),
            )
            .unwrap();
            rows
        };
        assert!(list().iter().any(|e| e.name == "Library"));
        assert!(!list().iter().any(|e| e.name == "excluded"));
        fs::create_dir(dir.path().join("ProjectSettings")).unwrap();
        fs::write(
            dir.path().join("ProjectSettings/ProjectVersion.txt"),
            "m_EditorVersion: 6000.0",
        )
        .unwrap();
        assert!(!list().iter().any(|e| e.name == "Library"));
        let mut files = Vec::new();
        scan(
            dir.path(),
            "files",
            &excludes,
            "rules",
            &AtomicBool::new(false),
            &Mutex::default(),
            (MAX_ENTRIES, MAX_MILLIS),
            |batch| {
                files.extend(batch.files);
                true
            },
        )
        .unwrap();
        assert!(!files.iter().any(|e| e.name == "private.md"));
        assert!(read_document(&dir.path().join("docs/private.md")).is_ok());
    }

    #[test]
    fn running_scan_stops_between_batches_and_skips_large_heading_files() {
        let dir = tempfile::tempdir().unwrap();
        for i in 0..400 {
            fs::write(dir.path().join(format!("{i}.md")), "# Heading").unwrap();
        }
        let cancel = AtomicBool::new(false);
        let mut batches = Vec::new();
        scan(
            dir.path(),
            "files",
            &[],
            "cancel",
            &cancel,
            &Mutex::default(),
            (MAX_ENTRIES, MAX_MILLIS),
            |batch| {
                if !batch.complete {
                    cancel.store(true, Ordering::Relaxed);
                }
                batches.push(batch);
                true
            },
        )
        .unwrap();
        assert!(batches.last().unwrap().cancelled);
        assert!(batches.last().unwrap().scanned < 400);
        let large = tempfile::tempdir().unwrap();
        fs::write(
            large.path().join("large.md"),
            vec![b'a'; MAX_DOCUMENT_BYTES as usize + 1],
        )
        .unwrap();
        crate::io_metrics::reset();
        let mut last = None;
        scan(
            large.path(),
            "headings",
            &[],
            "large",
            &AtomicBool::new(false),
            &Mutex::default(),
            (MAX_ENTRIES, MAX_MILLIS),
            |batch| {
                last = Some(batch);
                true
            },
        )
        .unwrap();
        assert_eq!(crate::io_metrics::snapshot().0, 0);
        assert_eq!(last.unwrap().skipped, 1);
    }

    #[test]
    fn heading_cache_reuses_unchanged_documents() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.md"), "# Cached").unwrap();
        let cache = Mutex::default();
        crate::io_metrics::reset();
        for _ in 0..2 {
            scan(
                dir.path(),
                "headings",
                &[],
                "cached",
                &AtomicBool::new(false),
                &cache,
                (MAX_ENTRIES, MAX_MILLIS),
                |_| true,
            )
            .unwrap();
        }
        assert_eq!(crate::io_metrics::snapshot().0, 1);
    }
}
