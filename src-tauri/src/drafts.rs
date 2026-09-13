use crate::documents::{blocking, Result};
use std::fs;
use tauri::AppHandle;

#[tauri::command]
pub async fn write_draft(
    app: AppHandle,
    path: String,
    content: String,
) -> Result<crate::DraftSummary> {
    blocking(move || crate::write_draft(app, path, content)).await
}
#[tauri::command]
pub async fn read_draft(app: AppHandle, path: String) -> Result<Option<crate::DraftContent>> {
    blocking(move || crate::read_draft(app, path)).await
}
#[tauri::command]
pub async fn delete_draft(app: AppHandle, path: String) -> Result<bool> {
    blocking(move || crate::delete_draft(app, path)).await
}
#[tauri::command]
pub async fn list_drafts(app: AppHandle, workspace: String) -> Result<Vec<crate::DraftSummary>> {
    blocking(move || crate::list_drafts(app, workspace)).await
}
#[tauri::command]
pub async fn move_draft(app: AppHandle, from: String, to: String) -> Result<()> {
    blocking(move || {
        if from == to {
            return Ok(());
        }
        if let Some(draft) = crate::read_draft(app.clone(), from.clone())? {
            crate::write_draft(app.clone(), to, draft.content)?;
            crate::delete_draft(app, from)?;
        }
        Ok(())
    })
    .await
}

pub fn write_atomic(path: &std::path::Path, bytes: &[u8]) -> Result<()> {
    use std::io::Write;
    let parent = path.parent().ok_or("草稿路径无效")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    file.write_all(bytes).map_err(|e| e.to_string())?;
    file.as_file().sync_all().map_err(|e| e.to_string())?;
    file.persist(path).map_err(|e| e.error.to_string())?;
    Ok(())
}
