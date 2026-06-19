const RUNTIME_DLLS: &[&str] = &[
    "avcodec-61.dll",
    "avdevice-61.dll",
    "avfilter-10.dll",
    "avformat-61.dll",
    "avutil-59.dll",
    "postproc-58.dll",
    "swresample-5.dll",
    "swscale-8.dll",
    "DirectML.dll",
];

#[cfg(windows)]
use std::path::{Path, PathBuf};

#[cfg(windows)]
pub fn configure_dll_search_path() {
    use windows_sys::Win32::System::LibraryLoader::{
        LOAD_LIBRARY_SEARCH_DEFAULT_DIRS, LOAD_LIBRARY_SEARCH_USER_DIRS, SetDefaultDllDirectories,
    };

    unsafe {
        SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_DEFAULT_DIRS | LOAD_LIBRARY_SEARCH_USER_DIRS);
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe()
        && let Some(exe_dir) = exe.parent()
    {
        candidates.push(exe_dir.to_path_buf());
        candidates.push(exe_dir.join("resources"));
        candidates.push(exe_dir.join("resources").join("windows-runtime"));
    }

    for candidate in candidates {
        register_dll_directory(&candidate);
    }
}

#[cfg(windows)]
fn register_dll_directory(path: &Path) {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::LibraryLoader::AddDllDirectory;

    if !path.is_dir() {
        return;
    }

    let has_runtime_dll = RUNTIME_DLLS.iter().any(|name| path.join(name).is_file());
    if !has_runtime_dll {
        return;
    }

    let wide: Vec<u16> = path.as_os_str().encode_wide().chain([0]).collect();
    unsafe {
        let handle = AddDllDirectory(wide.as_ptr());
        if handle.is_null() {
            tracing::warn!(?path, "AddDllDirectory failed for runtime DLL search path");
        }
    }
}

#[cfg(not(windows))]
pub fn configure_dll_search_path() {}
