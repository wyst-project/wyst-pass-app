import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { LogicalSize, getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "@tauri-apps/plugin-os";
import { openUrl } from "@tauri-apps/plugin-opener";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

export const WEB_URL = __WYST_WEB_URL__;
export const isMac = () => platform() === "macos";
export const isWindows = () => platform() === "windows";
export const window = () => getCurrentWindow();
export const WIZARD_SIZE = { width: 620, height: 480 };
export const VAULT_SIZE = { width: 1180, height: 760 };

export async function useWizardWindow() {
  const win = getCurrentWindow();
  await win.setMinSize(new LogicalSize(WIZARD_SIZE.width, WIZARD_SIZE.height));
  await win.setSize(new LogicalSize(WIZARD_SIZE.width, WIZARD_SIZE.height));
  await win.center();
}

export async function useVaultWindow() {
  const win = getCurrentWindow();
  await win.setMinSize(new LogicalSize(VAULT_SIZE.width, VAULT_SIZE.height));
  await win.setSize(new LogicalSize(VAULT_SIZE.width, VAULT_SIZE.height));
  await win.center();
}

export const minimize = () => getCurrentWindow().minimize();
export const close = () => getCurrentWindow().close();
export const appVersion = () => getVersion().catch(() => "0.0.0");
export const openInBrowser = (url: string) => openUrl(url).catch(() => {});
export const setHideOnClose = (value: boolean) =>
  invoke("set_hide_on_close", { value }).catch(() => {});

export async function setAutostart(value: boolean) {
  try {
    if (isWindows()) {
      await invoke("set_autostart", { enabled: value });
      return;
    }
    const current = await isEnabled();
    if (value && !current) await enable();
    if (!value && current) await disable();
  } catch {}
}

export interface SetupStatus {
  mode: "installed" | "setup" | "uninstall";
  installDir: string;
  exePath: string;
  supported: boolean;
}

export const getSetupStatus = () => invoke<SetupStatus>("setup_status");
export const startedMinimized = () =>
  invoke<boolean>("started_minimized").catch(() => false);

export interface InstallProgress {
  step: "copy" | "shortcuts" | "registry" | "autostart" | "files";
  state: "running" | "ok" | "skipped" | "failed";
  detail: string;
}

export const onInstallProgress = (
  handler: (progress: InstallProgress) => void,
): Promise<UnlistenFn> =>
  listen<InstallProgress>("wyst-pass:install", (event) =>
    handler(event.payload),
  );

export const installApp = (options: {
  desktopShortcut: boolean;
  startMenu: boolean;
  autostart: boolean;
}) => invoke<string>("install_app", options);

export const launchInstalled = () => invoke("launch_installed");
export const uninstallApp = (removeData: boolean) =>
  invoke("uninstall_app", { removeData });

export const exitApp = () => getCurrentWindow().close();
export const onTrayLock = (handler: () => void): Promise<UnlistenFn> =>
  listen("wyst-pass:lock", handler);