//! Windows recycling must never fall back to permanent deletion.
//! https://learn.microsoft.com/windows/win32/api/shobjidl_core/nf-shobjidl_core-ifileoperation-setoperationflags
//! https://learn.microsoft.com/windows/win32/api/shobjidl_core/nf-shobjidl_core-ifileoperationprogresssink-predeleteitem
use std::{
    path::Path,
    sync::{Arc, Mutex},
};
use windows::{
    core::{implement, Ref, Result, HRESULT, HSTRING, PCWSTR},
    Win32::{
        Foundation::{E_ABORT, RPC_E_CHANGED_MODE},
        System::Com::{
            CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
            COINIT_APARTMENTTHREADED,
        },
        UI::Shell::{
            FileOperation, IFileOperation, IFileOperationProgressSink,
            IFileOperationProgressSink_Impl, IShellItem, SHCreateItemFromParsingName,
            FOFX_ADDUNDORECORD, FOFX_EARLYFAILURE, FOFX_RECYCLEONDELETE, FOF_NO_UI,
            TSF_DELETE_RECYCLE_IF_POSSIBLE,
        },
    },
};

#[implement(IFileOperationProgressSink)]
struct RecycleOnly {
    failure: Arc<Mutex<Option<String>>>,
}

#[allow(non_snake_case)]
impl IFileOperationProgressSink_Impl for RecycleOnly_Impl {
    fn StartOperations(&self) -> Result<()> {
        Ok(())
    }
    fn FinishOperations(&self, result: HRESULT) -> Result<()> {
        if result.is_err() {
            *self.failure.lock().unwrap() = Some(result.to_string());
        }
        Ok(())
    }
    fn PreDeleteItem(&self, flags: u32, _: Ref<'_, IShellItem>) -> Result<()> {
        // The Shell reports a new pre-delete notification before permanent deletion.
        // Abort that notification, including fallback after a failed recycling attempt.
        if flags & TSF_DELETE_RECYCLE_IF_POSSIBLE.0 as u32 == 0 {
            *self.failure.lock().unwrap() = Some("此项目不能移入回收站，已中止操作".into());
            return Err(E_ABORT.into());
        }
        Ok(())
    }
    fn PostDeleteItem(
        &self,
        _: u32,
        _: Ref<'_, IShellItem>,
        result: HRESULT,
        _: Ref<'_, IShellItem>,
    ) -> Result<()> {
        if result.is_err() {
            *self.failure.lock().unwrap() = Some(result.to_string());
        }
        Ok(())
    }
    fn PreRenameItem(&self, _: u32, _: Ref<'_, IShellItem>, _: &PCWSTR) -> Result<()> {
        Err(E_ABORT.into())
    }
    fn PostRenameItem(
        &self,
        _: u32,
        _: Ref<'_, IShellItem>,
        _: &PCWSTR,
        _: HRESULT,
        _: Ref<'_, IShellItem>,
    ) -> Result<()> {
        Ok(())
    }
    fn PreMoveItem(
        &self,
        _: u32,
        _: Ref<'_, IShellItem>,
        _: Ref<'_, IShellItem>,
        _: &PCWSTR,
    ) -> Result<()> {
        Err(E_ABORT.into())
    }
    fn PostMoveItem(
        &self,
        _: u32,
        _: Ref<'_, IShellItem>,
        _: Ref<'_, IShellItem>,
        _: &PCWSTR,
        _: HRESULT,
        _: Ref<'_, IShellItem>,
    ) -> Result<()> {
        Ok(())
    }
    fn PreCopyItem(
        &self,
        _: u32,
        _: Ref<'_, IShellItem>,
        _: Ref<'_, IShellItem>,
        _: &PCWSTR,
    ) -> Result<()> {
        Err(E_ABORT.into())
    }
    fn PostCopyItem(
        &self,
        _: u32,
        _: Ref<'_, IShellItem>,
        _: Ref<'_, IShellItem>,
        _: &PCWSTR,
        _: HRESULT,
        _: Ref<'_, IShellItem>,
    ) -> Result<()> {
        Ok(())
    }
    fn PreNewItem(&self, _: u32, _: Ref<'_, IShellItem>, _: &PCWSTR) -> Result<()> {
        Err(E_ABORT.into())
    }
    fn PostNewItem(
        &self,
        _: u32,
        _: Ref<'_, IShellItem>,
        _: &PCWSTR,
        _: &PCWSTR,
        _: u32,
        _: HRESULT,
        _: Ref<'_, IShellItem>,
    ) -> Result<()> {
        Ok(())
    }
    fn UpdateProgress(&self, _: u32, _: u32) -> Result<()> {
        Ok(())
    }
    fn ResetTimer(&self) -> Result<()> {
        Ok(())
    }
    fn PauseTimer(&self) -> Result<()> {
        Ok(())
    }
    fn ResumeTimer(&self) -> Result<()> {
        Ok(())
    }
}

struct ComGuard(bool);
impl Drop for ComGuard {
    fn drop(&mut self) {
        if self.0 {
            unsafe { CoUninitialize() };
        }
    }
}

pub fn recycle(path: &Path) -> std::result::Result<(), String> {
    let path = crate::documents::display_path(&crate::documents::canonical(path)?);
    let initialized = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
    if initialized.is_err() && initialized != RPC_E_CHANGED_MODE {
        return Err(initialized.to_string());
    }
    let _com = ComGuard(initialized.is_ok());
    let failure = Arc::new(Mutex::new(None));
    let sink: IFileOperationProgressSink = RecycleOnly {
        failure: failure.clone(),
    }
    .into();
    let result = (|| -> Result<()> {
        unsafe {
            let operation: IFileOperation =
                CoCreateInstance(&FileOperation, None, CLSCTX_INPROC_SERVER)?;
            operation.SetOperationFlags(
                FOF_NO_UI | FOFX_RECYCLEONDELETE | FOFX_ADDUNDORECORD | FOFX_EARLYFAILURE,
            )?;
            let item: IShellItem = SHCreateItemFromParsingName(&HSTRING::from(path), None)?;
            operation.DeleteItem(&item, &sink)?;
            operation.PerformOperations()?;
            if operation.GetAnyOperationsAborted()?.as_bool() {
                return Err(E_ABORT.into());
            }
        }
        Ok(())
    })();
    if let Some(error) = failure.lock().unwrap().take() {
        return Err(error);
    }
    result.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_permanent_delete_notifications() {
        let failure = Arc::new(Mutex::new(None));
        let sink: IFileOperationProgressSink = RecycleOnly {
            failure: failure.clone(),
        }
        .into();
        unsafe {
            assert!(sink
                .PreDeleteItem(TSF_DELETE_RECYCLE_IF_POSSIBLE.0 as u32, None)
                .is_ok());
            assert!(sink.PreDeleteItem(0, None).is_err());
        }
        assert!(failure.lock().unwrap().is_some());
    }
    #[test]
    #[ignore = "Uses the Windows recycle bin for one project-owned fixture and restores only that fixture"]
    fn recycles_and_restores_own_fixture() {
        let project = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .canonicalize()
            .unwrap();
        let fixtures = project.join(".local/fixtures");
        std::fs::create_dir_all(&fixtures).unwrap();
        assert!(fixtures.canonicalize().unwrap().starts_with(&project));
        let dir = tempfile::Builder::new()
            .prefix("recycle-test-")
            .tempdir_in(fixtures)
            .unwrap();
        let file = dir.path().join("md-view-recycle-test.md");
        std::fs::write(&file, "recycle and restore fixture").unwrap();
        recycle(&file).unwrap();
        assert!(!file.exists());
        let expected = crate::documents::path_id(&file);
        let items: Vec<_> = trash::os_limited::list()
            .unwrap()
            .into_iter()
            .filter(|item| crate::documents::path_id(&item.original_path()) == expected)
            .collect();
        assert_eq!(
            items.len(),
            1,
            "The fixture must be recoverable from the recycle bin"
        );
        trash::os_limited::restore_all(items).unwrap();
        assert_eq!(
            std::fs::read_to_string(file).unwrap(),
            "recycle and restore fixture"
        );
    }
}
