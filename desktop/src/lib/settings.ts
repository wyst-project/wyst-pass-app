import { load, type Store } from "@tauri-apps/plugin-store";
import type { Locale } from "@/lib/i18n";

export interface Settings {
  setupDone: boolean;
  termsAccepted: boolean;
  autostart: boolean;
  hideOnClose: boolean;
  notifications: boolean;
  notificationSound: boolean;
  justInstalled: boolean;
  locale: Locale | null;
}

export const DEFAULT_SETTINGS: Settings = {
  setupDone: false,
  termsAccepted: false,
  autostart: true,
  hideOnClose: true,
  notifications: true,
  notificationSound: true,
  justInstalled: false,
  locale: null,
};

let store: Store | null = null;

async function open() {
  if (!store)
    store = await load("settings.json", { autoSave: true, defaults: {} });
  return store;
}

export async function readSettings(): Promise<Settings> {
  try {
    const s = await open();
    const saved = (await s.get<Partial<Settings>>("settings")) ?? {};
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const current = await readSettings();
  const next = { ...current, ...patch };
  try {
    const s = await open();
    await s.set("settings", next);
    await s.save();
  } catch {}
  return next;
}