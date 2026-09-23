use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const APP_DIR_NAME: &str = "Wyst Pass";
pub const EXE_NAME: &str = "Wyst Pass.exe";
const UNINSTALL_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\WystPass";
const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const RUN_VALUE: &str = "Wyst Pass";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatus {
    pub mode: String,
    pub install_dir: String,
    pub exe_path: String,
    pub supported: bool,
}

#[derive(Serialize, Clone)]
struct Progress {
    step: String,
    state: String,
    detail: String,
}

fn emit(app: &AppHandle, step: &str, state: &str, detail: impl Into<String>) {
    let _ = app.emit(
        "wyst-pass:install",
        Progress { step: step.into(), state: state.into(), detail: detail.into() },
    );
}

pub fn install_dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|base| PathBuf::from(base).join("Programs").join(APP_DIR_NAME))
}

pub fn installed_exe() -> Option<PathBuf> {
    install_dir().map(|dir| dir.join(EXE_NAME))
}

fn same_file(a: &PathBuf, b: &PathBuf) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(x), Ok(y)) => x == y,
        _ => a == b,
    }
}

pub fn is_installed_copy() -> bool {
    match (std::env::current_exe(), installed_exe()) {
        (Ok(current), Some(installed)) => installed.exists() && same_file(&current, &installed),
        _ => false,
    }
}

pub fn wants_uninstall() -> bool {
    std::env::args().any(|arg| arg == "--uninstall")
}

pub fn status() -> SetupStatus {
    let supported = cfg!(target_os = "windows");
    let install = install_dir().unwrap_or_default();
    let exe = std::env::current_exe().unwrap_or_default();
    let mode = if !supported {
        "installed"
    } else if wants_uninstall() {
        "uninstall"
    } else if is_installed_copy() {
        "installed"
    } else {
        "setup"
    };
    SetupStatus {
        mode: mode.into(),
        install_dir: install.to_string_lossy().into_owned(),
        exe_path: exe.to_string_lossy().into_owned(),
        supported,
    }
}

#[cfg(target_os = "windows")]
mod win {
    use super::*;
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    fn ps(script: &str) -> Result<(), String> {
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;
        if output.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
        }
    }

    fn reg(args: &[&str]) -> Result<(), String> {
        let output = Command::new("reg").args(args).creation_flags(CREATE_NO_WINDOW).output().map_err(|e| e.to_string())?;
        if output.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
        }
    }

    fn q(value: &str) -> String {
        format!("'{}'", value.replace('\'', "''"))
    }

    fn shortcut_script(lnk_expr: &str, exe: &str, dir: &str) -> String {
        format!(
            "$s = (New-Object -ComObject WScript.Shell).CreateShortcut({lnk}); $s.TargetPath = {exe}; $s.WorkingDirectory = {dir}; $s.IconLocation = {icon}; $s.Description = 'Wyst Pass'; $s.Save()",
            lnk = lnk_expr,
            exe = q(exe),
            dir = q(dir),
            icon = q(&format!("{exe},0")),
        )
    }

    fn start_menu_lnk() -> String {
        "(Join-Path ([Environment]::GetFolderPath('Programs')) 'Wyst Pass.lnk')".into()
    }

    fn desktop_lnk() -> String {
        "(Join-Path ([Environment]::GetFolderPath('Desktop')) 'Wyst Pass.lnk')".into()
    }

    fn copy_with_retry(from: &PathBuf, to: &PathBuf) -> Result<(), String> {
        match std::fs::copy(from, to) {
            Ok(_) => Ok(()),
            Err(first) => {
                let _ = Command::new("taskkill").args(["/IM", EXE_NAME, "/F"]).creation_flags(CREATE_NO_WINDOW).output();
                std::thread::sleep(std::time::Duration::from_millis(800));
                std::fs::copy(from, to).map(|_| ()).map_err(|e| format!("{first} / {e}"))
            }
        }
    }

    pub fn install(app: &AppHandle, desktop_shortcut: bool, start_menu: bool, autostart: bool, version: &str) -> Result<String, String> {
        let dir = install_dir().ok_or("LOCALAPPDATA is not set")?;
        let target = dir.join(EXE_NAME);
        let source = std::env::current_exe().map_err(|e| e.to_string())?;
        let dir_str = dir.to_string_lossy().into_owned();
        let exe_str = target.to_string_lossy().into_owned();

        emit(app, "copy", "running", "");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        if !same_file(&source, &target) {
            copy_with_retry(&source, &target)?;
        }
        emit(app, "copy", "ok", exe_str.clone());

        emit(app, "shortcuts", "running", "");
        if start_menu {
            ps(&shortcut_script(&start_menu_lnk(), &exe_str, &dir_str))?;
        }
        if desktop_shortcut {
            ps(&shortcut_script(&desktop_lnk(), &exe_str, &dir_str))?;
        }
        emit(app, "shortcuts", if start_menu || desktop_shortcut { "ok" } else { "skipped" }, "");

        emit(app, "registry", "running", "");
        let size_kb = std::fs::metadata(&target).map(|m| m.len() / 1024).unwrap_or(4096).to_string();
        let uninstall = format!("\"{exe_str}\" --uninstall");
        let entries: [(&str, &str, &str); 11] = [
            ("DisplayName", "REG_SZ", "Wyst Pass"),
            ("DisplayVersion", "REG_SZ", version),
            ("Publisher", "REG_SZ", "Wyst"),
            ("DisplayIcon", "REG_SZ", &exe_str),
            ("InstallLocation", "REG_SZ", &dir_str),
            ("UninstallString", "REG_SZ", &uninstall),
            ("QuietUninstallString", "REG_SZ", &uninstall),
            ("URLInfoAbout", "REG_SZ", "https://wyst.lol"),
            ("NoModify", "REG_DWORD", "1"),
            ("NoRepair", "REG_DWORD", "1"),
            ("EstimatedSize", "REG_DWORD", &size_kb),
        ];
        for (name, kind, value) in entries {
            reg(&["add", UNINSTALL_KEY, "/v", name, "/t", kind, "/d", value, "/f"])?;
        }
        emit(app, "registry", "ok", "");

        emit(app, "autostart", "running", "");
        set_autostart_for(&exe_str, autostart)?;
        emit(app, "autostart", if autostart { "ok" } else { "skipped" }, "");

        Ok(exe_str)
    }

    pub fn set_autostart_for(exe: &str, enabled: bool) -> Result<(), String> {
        if enabled {
            reg(&["add", RUN_KEY, "/v", RUN_VALUE, "/t", "REG_SZ", "/d", &format!("\"{exe}\" --minimized"), "/f"])
        } else {
            let _ = reg(&["delete", RUN_KEY, "/v", RUN_VALUE, "/f"]);
            Ok(())
        }
    }

    pub fn launch_installed() -> Result<(), String> {
        let exe = installed_exe().ok_or("LOCALAPPDATA is not set")?;
        let dir = exe.parent().map(|p| p.to_path_buf()).unwrap_or_default();
        Command::new(&exe).current_dir(dir).spawn().map(|_| ()).map_err(|e| e.to_string())
    }

    pub fn uninstall(app: &AppHandle, remove_data: bool) -> Result<(), String> {
        emit(app, "shortcuts", "running", "");
        let _ = ps(&format!("Remove-Item -LiteralPath {} -Force -ErrorAction SilentlyContinue", start_menu_lnk()));
        let _ = ps(&format!("Remove-Item -LiteralPath {} -Force -ErrorAction SilentlyContinue", desktop_lnk()));
        emit(app, "shortcuts", "ok", "");

        emit(app, "registry", "running", "");
        let _ = reg(&["delete", RUN_KEY, "/v", RUN_VALUE, "/f"]);
        let _ = reg(&["delete", UNINSTALL_KEY, "/f"]);
        emit(app, "registry", "ok", "");

        emit(app, "files", "running", "");
        let dir = install_dir().ok_or("LOCALAPPDATA is not set")?;
        let mut script = format!("ping 127.0.0.1 -n 3 > nul & rmdir /s /q \"{}\"", dir.to_string_lossy());
        if remove_data {
            for base in ["APPDATA", "LOCALAPPDATA"] {
                if let Some(root) = std::env::var_os(base) {
                    script.push_str(&format!(" & rmdir /s /q \"{}\"", PathBuf::from(root).join("lol.wyst.pass").to_string_lossy()));
                }
            }
        }
        Command::new("cmd").args(["/c", &script]).creation_flags(CREATE_NO_WINDOW).spawn().map_err(|e| e.to_string())?;
        emit(app, "files", "ok", "");
        Ok(())
    }
}

#[cfg(target_os = "windows")]
pub use win::*;

#[cfg(not(target_os = "windows"))]
mod other {
    use super::*;
    pub fn install(_app: &AppHandle, _d: bool, _s: bool, _a: bool, _v: &str) -> Result<String, String> {
        Err("Self install is only available on Windows".into())
    }
    pub fn set_autostart_for(_exe: &str, _enabled: bool) -> Result<(), String> {
        Err("Use the autostart plugin on this platform".into())
    }
    pub fn launch_installed() -> Result<(), String> {
        Err("Self install is only available on Windows".into())
    }
    pub fn uninstall(_app: &AppHandle, _remove_data: bool) -> Result<(), String> {
        Err("Self install is only available on Windows".into())
    }
}

#[cfg(not(target_os = "windows"))]
pub use other::*;
