use encoding_rs::GBK;
use serde::{Deserialize, Serialize};
use std::{
    collections::{hash_map::DefaultHasher, HashSet},
    fs,
    hash::{Hash, Hasher},
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Serialize)]
struct FileNode {
    path: String,
    name: String,
    kind: String,
    children: Vec<FileNode>,
    size: u64,
    modified_at: u64,
}

#[derive(Debug, Serialize)]
struct ReadFileResult {
    path: String,
    content: String,
    encoding: String,
    modified_at: u64,
}

#[derive(Debug, Serialize)]
struct OpenPathResult {
    kind: String,
    workspace_path: Option<String>,
    file_path: Option<String>,
    tree: Option<FileNode>,
    file: Option<ReadFileResult>,
}

#[derive(Debug, Serialize)]
struct SaveResult {
    ok: bool,
    conflict: bool,
    modified_at: Option<u64>,
    message: Option<String>,
}

#[derive(Debug, Serialize)]
struct Heading {
    level: usize,
    text: String,
    line: usize,
    anchor: String,
}

#[derive(Debug, Deserialize)]
struct LinkValidationRequest {
    href: String,
    kind: String,
}

#[derive(Debug, Serialize)]
struct LinkValidationResult {
    href: String,
    kind: String,
    ok: bool,
    target_path: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Serialize)]
struct WorkspaceHeading {
    path: String,
    file_name: String,
    level: usize,
    text: String,
    line: usize,
    anchor: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct DraftContent {
    path: String,
    content: String,
    updated_at: u64,
    content_hash: String,
}

#[derive(Debug, Serialize)]
struct DraftSummary {
    path: String,
    updated_at: u64,
    content_hash: String,
}

type AppResult<T> = Result<T, String>;

/// 同步命令默认在 Tauri 主线程执行，目录扫描等重 I/O 会卡住界面。
/// 统一用这个包装把阻塞工作丢到后台线程池。
async fn run_blocking<T, F>(task: F) -> AppResult<T>
where
    F: FnOnce() -> AppResult<T> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| format!("后台任务执行失败: {error}"))?
}

#[tauri::command]
async fn open_workspace(app: AppHandle, path: String) -> AppResult<FileNode> {
    run_blocking(move || {
        let root = PathBuf::from(&path);
        if !root.is_dir() {
            return Err("请选择有效目录".into());
        }
        allow_asset_directory(&app, &root)?;
        scan_directory(&root)
    })
    .await
}

#[tauri::command]
async fn open_path(app: AppHandle, path: String) -> AppResult<OpenPathResult> {
    run_blocking(move || open_path_sync(&app, path)).await
}

fn open_path_sync(app: &AppHandle, path: String) -> AppResult<OpenPathResult> {
    let source_path = PathBuf::from(path);

    if source_path.is_dir() {
        allow_asset_directory(&app, &source_path)?;
        let tree = scan_directory(&source_path)?;
        return Ok(OpenPathResult {
            kind: "workspace".into(),
            workspace_path: Some(normalize_path(&source_path)),
            file_path: None,
            tree: Some(tree),
            file: None,
        });
    }

    if source_path.is_file() {
        if !is_supported_text_path(&source_path) {
            return Err("Only supported text files can be opened.".into());
        }

        let workspace_path = source_path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."));
        allow_asset_directory(&app, &workspace_path)?;
        let file = read_file_path(&source_path)?;
        let tree = workspace_stub_tree(&workspace_path, &source_path)?;

        return Ok(OpenPathResult {
            kind: "file".into(),
            workspace_path: Some(normalize_path(&workspace_path)),
            file_path: Some(normalize_path(&source_path)),
            tree: Some(tree),
            file: Some(file),
        });
    }

    Err("路径不存在或无法访问".into())
}

fn workspace_stub_tree(workspace_path: &Path, file_path: &Path) -> AppResult<FileNode> {
    let workspace_metadata = fs::metadata(workspace_path).map_err(to_error)?;
    let file_metadata = fs::metadata(file_path).map_err(to_error)?;
    Ok(FileNode {
        path: normalize_path(workspace_path),
        name: workspace_path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_else(|| normalize_path(workspace_path)),
        kind: "directory".into(),
        children: vec![FileNode {
            path: normalize_path(file_path),
            name: file_path
                .file_name()
                .map(|value| value.to_string_lossy().to_string())
                .unwrap_or_else(|| normalize_path(file_path)),
            kind: "file".into(),
            children: Vec::new(),
            size: file_metadata.len(),
            modified_at: system_time_to_ms(file_metadata.modified().ok()),
        }],
        size: workspace_metadata.len(),
        modified_at: system_time_to_ms(workspace_metadata.modified().ok()),
    })
}

#[tauri::command]
async fn read_file(path: String) -> AppResult<ReadFileResult> {
    run_blocking(move || {
        let file_path = PathBuf::from(&path);
        if !file_path.is_file() {
            return Err("文件不存在".into());
        }
        if !is_supported_text_path(&file_path) {
            return Err("Only supported text files can be opened.".into());
        }
        read_file_path(&file_path)
    })
    .await
}

#[tauri::command]
fn initial_open_paths() -> Vec<String> {
    std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .filter(|path| path.exists() && (path.is_dir() || is_supported_text_path(path)))
        .map(|path| normalize_path(&path))
        .collect()
}

#[tauri::command]
async fn open_default_app_settings() -> AppResult<()> {
    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(register_user_file_associations)
            .await
            .map_err(to_error)??;
        hidden_command("explorer.exe")
            .arg("ms-settings:defaultapps")
            .spawn()
            .map(|_| ())
            .map_err(to_error)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("当前平台请在系统设置中手动选择默认应用".into())
    }
}

#[cfg(target_os = "windows")]
fn register_user_file_associations() -> AppResult<()> {
    cleanup_legacy_file_associations();

    let exe_path = std::env::current_exe().map_err(to_error)?;
    let exe_name = exe_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "md-view.exe".into());
    let exe_path = normalize_path(&exe_path);
    let app_name = "md-view";
    let prog_id = "MdView.Markdown";
    let open_command = format!("\"{}\" \"%1\"", exe_path);
    let icon = format!("\"{}\",0", exe_path);

    reg_add_default("HKCU\\Software\\Classes\\MdView.Markdown", "Markdown 文档")?;
    reg_add_default("HKCU\\Software\\Classes\\MdView.Markdown\\DefaultIcon", &icon)?;
    reg_add_default(
        "HKCU\\Software\\Classes\\MdView.Markdown\\shell\\open",
        "使用 md-view 打开",
    )?;
    reg_add_default(
        "HKCU\\Software\\Classes\\MdView.Markdown\\shell\\open\\command",
        &open_command,
    )?;

    for extension in [".md", ".markdown"] {
        reg_add_default(&format!("HKCU\\Software\\Classes\\{extension}"), prog_id)?;
        reg_add_value(
            &format!("HKCU\\Software\\Classes\\{extension}\\OpenWithProgids"),
            prog_id,
            "",
        )?;
    }

    let application_key = format!("HKCU\\Software\\Classes\\Applications\\{exe_name}");
    reg_add_default(
        &format!("{application_key}\\shell\\open\\command"),
        &open_command,
    )?;
    for extension in [".md", ".markdown"] {
        reg_add_value(
            &format!("{application_key}\\SupportedTypes"),
            extension,
            "",
        )?;
    }

    reg_add_value(
        "HKCU\\Software\\MdView\\Capabilities",
        "ApplicationName",
        app_name,
    )?;
    reg_add_value(
        "HKCU\\Software\\MdView\\Capabilities",
        "ApplicationDescription",
        "md-view Markdown 阅读与编辑器",
    )?;
    for extension in [".md", ".markdown"] {
        reg_add_value(
            "HKCU\\Software\\MdView\\Capabilities\\FileAssociations",
            extension,
            prog_id,
        )?;
    }
    reg_add_value(
        "HKCU\\Software\\RegisteredApplications",
        app_name,
        "Software\\MdView\\Capabilities",
    )?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn cleanup_legacy_file_associations() {
    let _ = run_reg(["delete", "HKCU\\Software\\Classes\\MarkdownReaderEditor.Markdown", "/f"]);
    let _ = run_reg(["delete", "HKCU\\Software\\MarkdownReaderEditor", "/f"]);
    let _ = run_reg([
        "delete",
        "HKCU\\Software\\RegisteredApplications",
        "/v",
        "Markdown 本地阅读编辑器",
        "/f",
    ]);
}

#[cfg(target_os = "windows")]
fn reg_add_default(key: &str, value: &str) -> AppResult<()> {
    run_reg(["add", key, "/ve", "/d", value, "/f"])
}

#[cfg(target_os = "windows")]
fn reg_add_value(key: &str, name: &str, value: &str) -> AppResult<()> {
    run_reg(["add", key, "/v", name, "/d", value, "/f"])
}

#[cfg(target_os = "windows")]
fn run_reg<const N: usize>(args: [&str; N]) -> AppResult<()> {
    let output = hidden_command("reg.exe").args(args).output().map_err(to_error)?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Err(if stderr.is_empty() { stdout } else { stderr })
}

#[cfg(target_os = "windows")]
fn hidden_command(program: &str) -> Command {
    let mut command = Command::new(program);
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

fn read_file_path(file_path: &Path) -> AppResult<ReadFileResult> {
    let bytes = fs::read(&file_path).map_err(to_error)?;
    if is_probably_binary_bytes(&bytes) {
        return Err("This file appears to be binary and cannot be opened as text.".into());
    }
    let (content, encoding) = decode_text(&bytes)?;
    let modified_at = modified_at(&file_path)?;
    Ok(ReadFileResult {
        path: normalize_path(file_path),
        content,
        encoding,
        modified_at,
    })
}

#[tauri::command]
async fn save_file(path: String, content: String, expected: Option<u64>, overwrite: bool) -> AppResult<SaveResult> {
    run_blocking(move || {
        let file_path = PathBuf::from(&path);
        if !file_path.is_file() {
            return Err("文件不存在，无法保存".into());
        }

        if !is_supported_text_path(&file_path) {
            return Err("Only supported text files can be saved.".into());
        }

        let current_modified = modified_at(&file_path)?;
        if let Some(expected_modified) = expected {
            if current_modified != expected_modified && !overwrite {
                return Ok(SaveResult {
                    ok: false,
                    conflict: true,
                    modified_at: Some(current_modified),
                    message: Some("磁盘文件已被外部修改。".into()),
                });
            }
        }

        fs::write(&file_path, content.as_bytes()).map_err(to_error)?;
        let modified_at = modified_at(&file_path)?;
        Ok(SaveResult {
            ok: true,
            conflict: false,
            modified_at: Some(modified_at),
            message: None,
        })
    })
    .await
}

#[tauri::command]
fn extract_outline(content: String) -> Vec<Heading> {
    extract_headings_from_content(&content)
}

#[tauri::command]
async fn validate_local_links(
    markdown_path: String,
    links: Vec<LinkValidationRequest>,
) -> AppResult<Vec<LinkValidationResult>> {
    run_blocking(move || {
        let base_file = PathBuf::from(&markdown_path);
        let base_dir = base_file.parent().map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from("."));
        let current_content = if base_file.is_file() {
            read_file_path(&base_file).ok().map(|file| file.content)
        } else {
            None
        };
        let current_anchors = current_content
            .as_ref()
            .map(|content| heading_anchor_set(&extract_headings_from_content(content)))
            .unwrap_or_default();

        Ok(links
            .into_iter()
            .map(|link| validate_one_link(&base_dir, &current_anchors, link))
            .collect())
    })
    .await
}

#[tauri::command]
async fn index_workspace_headings(workspace: String) -> AppResult<Vec<WorkspaceHeading>> {
    run_blocking(move || {
        let root = PathBuf::from(workspace);
        if !root.is_dir() {
            return Err("Workspace path is not a directory.".into());
        }

        let mut headings = Vec::new();
        collect_workspace_headings(&root, &mut headings)?;
        headings.sort_by(|left, right| {
            left.path
                .to_lowercase()
                .cmp(&right.path.to_lowercase())
                .then_with(|| left.line.cmp(&right.line))
        });
        Ok(headings)
    })
    .await
}

#[tauri::command]
async fn export_html(path: String, html: String) -> AppResult<()> {
    run_blocking(move || {
        let output = PathBuf::from(path);
        if let Some(parent) = output.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(to_error)?;
            }
        }
        let mut file = fs::File::create(output).map_err(to_error)?;
        file.write_all(html.as_bytes()).map_err(to_error)
    })
    .await
}

fn extract_headings_from_content(content: &str) -> Vec<Heading> {
    let mut headings = Vec::new();
    let mut in_fence = false;

    for (index, line) in content.lines().enumerate() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence || !trimmed.starts_with('#') {
            continue;
        }

        let level = trimmed.chars().take_while(|char| *char == '#').count();
        if level == 0 || level > 6 {
            continue;
        }
        let rest = &trimmed[level..];
        if !rest.starts_with(' ') {
            continue;
        }
        let text = rest.trim().trim_end_matches('#').trim().to_string();
        if text.is_empty() {
            continue;
        }
        let line_number = index + 1;
        headings.push(Heading {
            level,
            text,
            line: line_number,
            anchor: format!("heading-{line_number}"),
        });
    }

    headings
}

fn heading_anchor_set(headings: &[Heading]) -> HashSet<String> {
    headings
        .iter()
        .enumerate()
        .flat_map(|(index, heading)| {
            [
                heading.anchor.clone(),
                slug_heading(&heading.text, index),
                format!("heading-{}", heading.line),
            ]
        })
        .collect()
}

fn validate_one_link(base_dir: &Path, current_anchors: &HashSet<String>, link: LinkValidationRequest) -> LinkValidationResult {
    let href = link.href.trim().to_string();
    let kind = link.kind;
    if href.is_empty() || is_external_href(&href) {
        return link_result(href, kind, true, None, None);
    }

    if let Some(anchor) = href.strip_prefix('#') {
        let ok = current_anchors.contains(anchor);
        return link_result(
            href,
            kind,
            ok,
            None,
            if ok { None } else { Some("Heading anchor not found.".into()) },
        );
    }

    let (path_part, anchor) = split_href_path_anchor(&href);
    let target = resolve_link_path(base_dir, path_part);
    if !target.exists() {
        return link_result(
            href,
            kind,
            false,
            Some(normalize_path(&target)),
            Some("Local target not found.".into()),
        );
    }

    if let Some(anchor) = anchor {
        if is_markdown_path(&target) {
            if let Ok(file) = read_file_path(&target) {
                let anchors = heading_anchor_set(&extract_headings_from_content(&file.content));
                let ok = anchors.contains(anchor);
                return link_result(
                    href,
                    kind,
                    ok,
                    Some(normalize_path(&target)),
                    if ok { None } else { Some("Target heading not found.".into()) },
                );
            }
        }
    }

    link_result(href, kind, true, Some(normalize_path(&target)), None)
}

fn link_result(href: String, kind: String, ok: bool, target_path: Option<String>, message: Option<String>) -> LinkValidationResult {
    LinkValidationResult {
        href,
        kind,
        ok,
        target_path,
        message,
    }
}

#[tauri::command]
fn open_external_url(url: String) -> AppResult<()> {
    if !is_allowed_external_url(&url) {
        return Err("Only http, https, mailto, and tel links can be opened externally.".into());
    }

    #[cfg(target_os = "windows")]
    {
        hidden_command("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &url])
            .spawn()
            .map(|_| ())
            .map_err(to_error)
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map(|_| ())
            .map_err(to_error)
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map(|_| ())
            .map_err(to_error)
    }
}

fn is_external_href(href: &str) -> bool {
    let lower = href.to_lowercase();
    lower.starts_with("http:")
        || lower.starts_with("https:")
        || lower.starts_with("mailto:")
        || lower.starts_with("tel:")
        || lower.starts_with("data:")
        || lower.starts_with("blob:")
        || lower.starts_with("asset:")
}

fn is_allowed_external_url(url: &str) -> bool {
    if url.chars().any(|char| char.is_control()) {
        return false;
    }
    let lower = url.trim().to_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://") || lower.starts_with("mailto:") || lower.starts_with("tel:")
}

fn split_href_path_anchor(href: &str) -> (&str, Option<&str>) {
    let clean = href.split('?').next().unwrap_or(href);
    let mut parts = clean.splitn(2, '#');
    let path = parts.next().unwrap_or(clean);
    (path, parts.next().filter(|anchor| !anchor.is_empty()))
}

fn resolve_link_path(base_dir: &Path, source: &str) -> PathBuf {
    let decoded = percent_decode_path(source);
    let path = PathBuf::from(decoded);
    if path.is_absolute() {
        path
    } else {
        base_dir.join(path)
    }
}

fn percent_decode_path(source: &str) -> String {
    let mut output = String::new();
    let bytes = source.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(value) = u8::from_str_radix(&source[index + 1..index + 3], 16) {
                output.push(value as char);
                index += 3;
                continue;
            }
        }
        output.push(bytes[index] as char);
        index += 1;
    }
    output
}

fn collect_workspace_headings(root: &Path, headings: &mut Vec<WorkspaceHeading>) -> AppResult<()> {
    for entry in fs::read_dir(root).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if should_skip(&name) {
            continue;
        }
        if path.is_dir() {
            collect_workspace_headings(&path, headings)?;
            continue;
        }
        if !is_markdown_path(&path) {
            continue;
        }
        let file = read_file_path(&path)?;
        for heading in extract_headings_from_content(&file.content) {
            headings.push(WorkspaceHeading {
                path: normalize_path(&path),
                file_name: name.clone(),
                level: heading.level,
                text: heading.text,
                line: heading.line,
                anchor: heading.anchor,
            });
        }
    }
    Ok(())
}

#[tauri::command]
fn write_draft(app: AppHandle, path: String, content: String) -> AppResult<DraftSummary> {
    let draft = DraftContent {
        path: path.clone(),
        content_hash: stable_hash(&content),
        content,
        updated_at: now_ms(),
    };
    let drafts_dir = drafts_dir(&app)?;
    fs::create_dir_all(&drafts_dir).map_err(to_error)?;
    let draft_path = draft_path(&drafts_dir, &path);
    let bytes = serde_json::to_vec_pretty(&draft).map_err(to_error)?;
    fs::write(draft_path, bytes).map_err(to_error)?;
    Ok(DraftSummary {
        path,
        updated_at: draft.updated_at,
        content_hash: draft.content_hash,
    })
}

#[tauri::command]
fn read_draft(app: AppHandle, path: String) -> AppResult<Option<DraftContent>> {
    let drafts_dir = drafts_dir(&app)?;
    let draft_path = draft_path(&drafts_dir, &path);
    if !draft_path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(draft_path).map_err(to_error)?;
    let draft = serde_json::from_slice::<DraftContent>(&bytes).map_err(to_error)?;
    Ok(Some(draft))
}

#[tauri::command]
fn delete_draft(app: AppHandle, path: String) -> AppResult<bool> {
    let drafts_dir = drafts_dir(&app)?;
    let draft_path = draft_path(&drafts_dir, &path);
    if draft_path.exists() {
        fs::remove_file(draft_path).map_err(to_error)?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
fn list_drafts(app: AppHandle, workspace: String) -> AppResult<Vec<DraftSummary>> {
    let drafts_dir = drafts_dir(&app)?;
    let workspace_path = PathBuf::from(workspace);
    if !drafts_dir.exists() {
        return Ok(Vec::new());
    }

    let mut drafts = Vec::new();
    for entry in fs::read_dir(drafts_dir).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let bytes = fs::read(path).map_err(to_error)?;
        let draft = serde_json::from_slice::<DraftContent>(&bytes).map_err(to_error)?;
        if PathBuf::from(&draft.path).starts_with(&workspace_path) {
            drafts.push(DraftSummary {
                path: draft.path,
                updated_at: draft.updated_at,
                content_hash: draft.content_hash,
            });
        }
    }
    drafts.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(drafts)
}

#[tauri::command]
fn clear_workspace_drafts(app: AppHandle, workspace: String) -> AppResult<usize> {
    let drafts_dir = drafts_dir(&app)?;
    let workspace_path = PathBuf::from(workspace);
    if !drafts_dir.exists() {
        return Ok(0);
    }

    let mut removed = 0;
    for entry in fs::read_dir(drafts_dir).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }

        let bytes = fs::read(&path).map_err(to_error)?;
        let draft = serde_json::from_slice::<DraftContent>(&bytes).map_err(to_error)?;
        if PathBuf::from(&draft.path).starts_with(&workspace_path) {
            fs::remove_file(path).map_err(to_error)?;
            removed += 1;
        }
    }

    Ok(removed)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 窗口配置为 hidden，由前端在首帧后显示；
            // 这里兜底：万一前端初始化失败，4 秒后强制显示，避免出现"隐形"应用。
            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(4));
                    let _ = window.show();
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_workspace,
            open_path,
            read_file,
            save_file,
            extract_outline,
            write_draft,
            read_draft,
            delete_draft,
            list_drafts,
            clear_workspace_drafts,
            initial_open_paths,
            open_default_app_settings,
            open_external_url,
            validate_local_links,
            index_workspace_headings,
            export_html
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn scan_directory(path: &Path) -> AppResult<FileNode> {
    let metadata = fs::metadata(path).map_err(to_error)?;
    let mut children = Vec::new();

    for entry in fs::read_dir(path).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        let child_path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if should_skip(&file_name) {
            continue;
        }

        if child_path.is_file() && is_browsable_text_path(&child_path) {
            let child_metadata = fs::metadata(&child_path).map_err(to_error)?;
            children.push(FileNode {
                path: normalize_path(&child_path),
                name: file_name,
                kind: "file".into(),
                children: Vec::new(),
                size: child_metadata.len(),
                modified_at: system_time_to_ms(child_metadata.modified().ok()),
            });
        }
    }

    children.sort_by(|left, right| {
        let left_rank = if left.kind == "directory" { 0 } else { 1 };
        let right_rank = if right.kind == "directory" { 0 } else { 1 };
        left_rank
            .cmp(&right_rank)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    Ok(FileNode {
        path: normalize_path(path),
        name: path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_else(|| normalize_path(path)),
        kind: "directory".into(),
        children,
        size: metadata.len(),
        modified_at: system_time_to_ms(metadata.modified().ok()),
    })
}

fn should_skip(name: &str) -> bool {
    matches!(
        name,
        ".git" | ".svn" | ".hg" | "node_modules" | "target" | "dist" | ".svelte-kit"
    )
}

fn is_markdown_path(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|value| value.to_str()).map(|value| value.to_lowercase()),
        Some(extension) if extension == "md" || extension == "markdown"
    )
}

fn is_browsable_text_path(path: &Path) -> bool {
    if is_markdown_path(path) {
        return true;
    }

    matches!(
        path.extension().and_then(|value| value.to_str()).map(|value| value.to_lowercase()),
        Some(extension) if extension == "txt"
    )
}

fn is_supported_text_path(path: &Path) -> bool {
    if is_browsable_text_path(path) {
        return true;
    }

    match path.extension().and_then(|value| value.to_str()) {
        Some(_) => is_probably_text_file(path),
        None => path.exists() && is_probably_text_file(path),
    }
}

fn is_probably_text_file(path: &Path) -> bool {
    let Ok(mut file) = fs::File::open(path) else {
        return false;
    };
    let mut buffer = [0_u8; 8192];
    let Ok(read) = file.read(&mut buffer) else {
        return false;
    };
    !is_probably_binary_bytes(&buffer[..read])
}

fn is_probably_binary_bytes(bytes: &[u8]) -> bool {
    if bytes.is_empty() {
        return false;
    }

    let sample = &bytes[..bytes.len().min(8192)];
    if sample.iter().any(|byte| *byte == 0) {
        return true;
    }

    let control_count = sample
        .iter()
        .filter(|byte| matches!(**byte, 0x01..=0x08 | 0x0B | 0x0C | 0x0E..=0x1F))
        .count();

    control_count * 100 / sample.len() > 5
}

fn decode_text(bytes: &[u8]) -> AppResult<(String, String)> {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        if let Ok(content) = String::from_utf8(bytes[3..].to_vec()) {
            return Ok((content, "UTF-8 BOM".into()));
        }
    }

    if let Ok(content) = String::from_utf8(bytes.to_vec()) {
        return Ok((content, "UTF-8".into()));
    }

    let (content, _, had_errors) = GBK.decode(bytes);
    if had_errors && is_mostly_replacement_chars(&content) {
        return Err("This file could not be decoded as UTF-8 or GBK text.".into());
    }
    let encoding = if had_errors { "GBK/ANSI fallback" } else { "GBK" };
    Ok((content.into_owned(), encoding.into()))
}

fn is_mostly_replacement_chars(content: &str) -> bool {
    let total = content.chars().count();
    if total == 0 {
        return false;
    }
    let replacements = content.chars().filter(|char| *char == '\u{FFFD}').count();
    replacements * 100 / total > 10
}

fn allow_asset_directory(app: &AppHandle, path: &Path) -> AppResult<()> {
    app.asset_protocol_scope()
        .allow_directory(path, true)
        .map_err(to_error)
}

fn modified_at(path: &Path) -> AppResult<u64> {
    let metadata = fs::metadata(path).map_err(to_error)?;
    Ok(system_time_to_ms(metadata.modified().ok()))
}

fn system_time_to_ms(time: Option<SystemTime>) -> u64 {
    time.and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn now_ms() -> u64 {
    system_time_to_ms(Some(SystemTime::now()))
}

fn drafts_dir(app: &AppHandle) -> AppResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("drafts"))
        .map_err(to_error)
}

fn draft_path(drafts_dir: &Path, source_path: &str) -> PathBuf {
    drafts_dir.join(format!("{}.json", stable_hash(source_path)))
}

fn stable_hash(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn slug_heading(text: &str, index: usize) -> String {
    let mut slug = String::new();
    let mut previous_dash = false;
    for char in text.trim().to_lowercase().chars() {
        if char.is_alphanumeric() {
            slug.push(char);
            previous_dash = false;
        } else if char.is_whitespace() || char == '-' {
            if !previous_dash && !slug.is_empty() {
                slug.push('-');
                previous_dash = true;
            }
        }
    }
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        format!("heading-{}", index + 1)
    } else {
        format!("heading-{slug}")
    }
}

fn to_error<E: std::fmt::Display>(error: E) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn supported_text_extensions_are_allowed() {
        for path in ["notes.txt", "README.md", "guide.markdown"] {
            assert!(is_supported_text_path(Path::new(path)), "{path}");
        }
    }

    #[test]
    fn browsable_text_extensions_are_explicitly_allowed() {
        for path in ["README.md", "guide.markdown", "notes.txt"] {
            assert!(is_browsable_text_path(Path::new(path)), "{path}");
        }
    }

    #[test]
    fn unknown_extensions_are_not_browsable_text() {
        for path in ["App.svelte", "script.ts", "settings.json", "Cargo.toml", ".env", ".gitignore", "preview.png"] {
            assert!(!is_browsable_text_path(Path::new(path)), "{path}");
        }
    }

    #[test]
    fn binary_bytes_are_rejected() {
        assert!(is_probably_binary_bytes(&[0, 1, 2, 3, 4]));
        assert!(!is_probably_binary_bytes(b"plain text\nwith lines\n"));
    }

    #[test]
    fn utf8_bom_is_decoded_as_text() {
        let (content, encoding) = decode_text(&[0xEF, 0xBB, 0xBF, b'a', b'b']).unwrap();
        assert_eq!(content, "ab");
        assert_eq!(encoding, "UTF-8 BOM");
    }
}
