mod notify;
mod setup;

use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};

#[derive(Default)]
struct Preferences {
    hide_on_close: Mutex<bool>,
}

#[tauri::command]
fn set_hide_on_close(state: State<'_, Preferences>, value: bool) {
    if let Ok(mut flag) = state.hide_on_close.lock() {
        *flag = value;
    }
}

#[tauri::command]
fn log_frontend(level: String, message: String) {
    eprintln!("[wyst-pass:{}] {}", level, message);
}

#[tauri::command]
fn setup_status() -> setup::SetupStatus {
    setup::status()
}

#[tauri::command]
fn started_minimized() -> bool {
    std::env::args().any(|arg| arg == "--minimized")
}

#[tauri::command]
async fn install_app(app: AppHandle, desktop_shortcut: bool, start_menu: bool, autostart: bool) -> Result<String, String> {
    let version = app.package_info().version.to_string();
    tauri::async_runtime::spawn_blocking(move || setup::install(&app, desktop_shortcut, start_menu, autostart, &version))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn launch_installed(app: AppHandle) -> Result<(), String> {
    setup::launch_installed()?;
    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn uninstall_app(app: AppHandle, remove_data: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || setup::uninstall(&app, remove_data))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn set_autostart(enabled: bool) -> Result<(), String> {
    let exe = setup::installed_exe()
        .filter(|path| path.exists())
        .or_else(|| std::env::current_exe().ok())
        .ok_or("no executable path")?;
    setup::set_autostart_for(&exe.to_string_lossy(), enabled)
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Ouvrir Wyst Pass", true, None::<&str>)?;
    let lock = MenuItem::with_id(app, "lock", "Verrouiller le coffre", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &lock, &PredefinedMenuItem::separator(app)?, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Wyst Pass")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "lock" => {
                let _ = app.emit("wyst-pass:lock", ());
                show_main(app);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let installed_copy = setup::is_installed_copy() && !setup::wants_uninstall();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])));
        if installed_copy {
            builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)));
        }
    }

    builder
        .manage(Preferences::default())
        .manage(notify::NotifyState::default())
        .invoke_handler(tauri::generate_handler![
            set_hide_on_close,
            log_frontend,
            setup_status,
            install_app,
            launch_installed,
            uninstall_app,
            set_autostart,
            started_minimized,
            notify::show_notification,
            notify::notification_ready,
            notify::notification_layout,
            notify::notification_done,
            notify::notification_action
        ])
        .setup(move |app| {
            if installed_copy {
                build_tray(app.handle())?;
                let minimized = std::env::args().any(|arg| arg == "--minimized");
                if minimized {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != "main" {
                    return;
                }
                let prefs: State<'_, Preferences> = window.state();
                let hide = prefs.hide_on_close.lock().map(|flag| *flag).unwrap_or(false);
                if hide {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Wyst Pass");
}