use crate::{
    documents::{blocking, Result},
    LinkValidationRequest, LinkValidationResult,
};
use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::{Mutex, OnceLock},
};

type Cache = HashMap<String, ((u64, std::time::SystemTime), HashSet<String>)>;
static ANCHORS: OnceLock<Mutex<Cache>> = OnceLock::new();

#[tauri::command]
pub async fn validate_local_links(
    markdown_path: String,
    links: Vec<LinkValidationRequest>,
    anchors: Option<Vec<String>>,
) -> Result<Vec<LinkValidationResult>> {
    blocking(move || {
        let file = PathBuf::from(&markdown_path);
        let base = file.parent().unwrap_or(std::path::Path::new("."));
        let current: HashSet<_> = anchors.unwrap_or_default().into_iter().collect();
        let mut seen = HashSet::new();
        let mut results = Vec::new();
        for link in links {
            if !seen.insert((link.href.clone(), link.kind.clone())) {
                continue;
            }
            let href = link.href.trim().to_string();
            let kind = link.kind;
            if href.is_empty() || crate::is_external_href(&href) {
                results.push(crate::link_result(href, kind, true, None, None));
                continue;
            }
            if let Some(anchor) = href.strip_prefix('#') {
                let ok = current.contains(&crate::percent_decode_path(anchor));
                results.push(crate::link_result(
                    href,
                    kind,
                    ok,
                    None,
                    if ok {
                        None
                    } else {
                        Some("Heading anchor not found.".into())
                    },
                ));
                continue;
            }
            let (path, anchor) = crate::split_href_path_anchor(&href);
            let target = crate::resolve_link_path(base, path);
            let metadata = std::fs::metadata(&target);
            let mut ok = metadata.is_ok();
            if let (Ok(metadata), Some(anchor)) = (metadata, anchor) {
                if crate::is_markdown_path(&target) && metadata.len() <= 2 * 1024 * 1024 {
                    let signature = (
                        metadata.len(),
                        metadata.modified().unwrap_or(std::time::UNIX_EPOCH),
                    );
                    let key = crate::documents::display_path(&target);
                    let cache = ANCHORS.get_or_init(Mutex::default);
                    let cached = cache
                        .lock()
                        .unwrap()
                        .get(&key)
                        .filter(|(sig, _)| *sig == signature)
                        .map(|(_, anchors)| anchors.clone());
                    let anchors = cached.or_else(|| {
                        crate::documents::read_document(&target).ok().map(|file| {
                            let anchors = crate::heading_anchor_set(
                                &crate::extract_headings_from_content(&file.content),
                            );
                            let mut cache = cache.lock().unwrap();
                            if cache.len() >= 128 {
                                cache.clear();
                            }
                            cache.insert(key, (signature, anchors.clone()));
                            anchors
                        })
                    });
                    ok = anchors.is_some_and(|anchors| {
                        anchors.contains(&crate::percent_decode_path(anchor))
                    });
                }
            }
            results.push(crate::link_result(
                href,
                kind,
                ok,
                Some(crate::documents::display_path(&target)),
                if ok {
                    None
                } else {
                    Some("Local file or heading not found.".into())
                },
            ));
        }
        Ok(results)
    })
    .await
}

#[tauri::command]
pub async fn export_html(path: String, html: String) -> Result<()> {
    blocking(move || crate::export_html(path, html)).await
}

#[tauri::command]
pub async fn initial_open_paths() -> Result<Vec<String>> {
    blocking(|| Ok(crate::initial_open_paths())).await
}
