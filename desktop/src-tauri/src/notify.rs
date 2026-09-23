use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

pub const LABEL: &str = "notification";
const WIDTH: f64 = 372.0;
const MARGIN: f64 = 16.0;

fn default_true() -> bool {
    true
}

fn default_duration() -> u64 {
    6500
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Notification {
    pub id: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub caption: Option<String>,
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub image: Option<String>,
    #[serde(default)]
    pub action_label: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default = "default_true")]
    pub sound: bool,
    #[serde(default = "default_duration")]
    pub duration_ms: u64,
}

#[derive(Default)]
pub struct NotifyState {
    queue: Mutex<Vec<Notification>>,
    ready: Mutex<bool>,
}

fn place(app: &AppHandle, height: f64) -> Result<(), String> {
    let window = app.get_webview_window(LABEL).ok_or("no notification window")?;
    let monitor = app.primary_monitor().map_err(|e| e.to_string())?.ok_or("no monitor")?;
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let width = (WIDTH * scale).round() as u32;
    let height = (height.max(80.0) * scale).round() as u32;
    let margin = (MARGIN * scale).round() as i32;
    let x = area.position.x + area.size.width as i32 - width as i32 - margin;
    let y = area.position.y + area.size.height as i32 - height as i32 - margin;
    window.set_size(PhysicalSize::new(width, height)).map_err(|e| e.to_string())?;
    window.set_position(PhysicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub async fn show_notification(app: AppHandle, state: State<'_, NotifyState>, notification: Notification) -> Result<(), String> {
    if app.get_webview_window(LABEL).is_some() {
        let ready = state.ready.lock().map(|flag| *flag).unwrap_or(false);
        if ready {
            app.emit_to(LABEL, "wyst-pass:notification", &notification).map_err(|e| e.to_string())?;
        } else if let Ok(mut queue) = state.queue.lock() {
            queue.push(notification);
        }
        return Ok(());
    }

    if let Ok(mut queue) = state.queue.lock() {
        queue.push(notification);
    }
    if let Ok(mut ready) = state.ready.lock() {
        *ready = false;
    }

    #[allow(unused_mut)]
    let mut builder = WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::App("notification.html".into()))
        .title("Wyst Pass")
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .focusable(false)
        .visible(false)
        .inner_size(WIDTH, 120.0);

    #[cfg(target_os = "windows")]
    {
        builder = builder.additional_browser_args(
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required",
        );
    }

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn notification_ready(app: AppHandle, state: State<'_, NotifyState>) -> Result<(), String> {
    if let Ok(mut ready) = state.ready.lock() {
        *ready = true;
    }
    let pending: Vec<Notification> = state.queue.lock().map(|mut queue| queue.drain(..).collect()).unwrap_or_default();
    for notification in pending {
        app.emit_to(LABEL, "wyst-pass:notification", &notification).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn notification_layout(app: AppHandle, height: f64) -> Result<(), String> {
    place(&app, height)?;
    if let Some(window) = app.get_webview_window(LABEL) {
        window.show().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn notification_done(app: AppHandle) {
    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.hide();
    }
}

#[tauri::command]
pub fn notification_action(app: AppHandle, action: String) {
    if action == "open" {
        show_main(&app);
    } else if action.starts_with("http://") || action.starts_with("https://") {
        let _ = app.opener().open_url(action, None::<&str>);
    }
}
