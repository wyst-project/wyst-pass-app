import { API_URL } from "@/lib/api/config";
export type DesktopOs = "windows" | "macos";

export const DESKTOP_OS_NAMES: Record<DesktopOs, string> = {
  windows: "Windows",
  macos: "macOS",
};

interface NavigatorWithUaData extends Navigator {
  userAgentData?: { platform?: string };
}

export function detectDesktopOs(): DesktopOs | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as NavigatorWithUaData;
  const platform = (
    nav.userAgentData?.platform ||
    nav.platform ||
    ""
  ).toLowerCase();
  const ua = (nav.userAgent || "").toLowerCase();
  if (/iphone|ipad|android/.test(ua)) return null;
  if (platform.startsWith("win") || /windows/.test(ua)) return "windows";
  if (platform.startsWith("mac") || /macintosh|mac os x/.test(ua))
    return "macos";
  return null;
}

export const otherDesktopOs = (os: DesktopOs): DesktopOs =>
  os === "windows" ? "macos" : "windows";
export const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface DesktopInfo {
  version: string;
  downloads: Record<DesktopOs, string | null>;
  extension: {
    version: string;
    download: string | null;
    stores: { chrome: string | null; edge: string | null };
  };
}

export const CHROMIUM_BROWSERS = [
  "Chrome",
  "Edge",
  "Brave",
  "Opera",
  "Vivaldi",
];

export interface Browser {
  name: string;
  chromium: boolean;
}

export function detectBrowser(): Browser | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return { name: "Edge", chromium: true };
  if (/OPR\//.test(ua)) return { name: "Opera", chromium: true };
  if (/Vivaldi/.test(ua)) return { name: "Vivaldi", chromium: true };
  if (/Brave/.test(ua) || "brave" in navigator)
    return { name: "Brave", chromium: true };
  if (/Firefox\//.test(ua)) return { name: "Firefox", chromium: false };
  if (/Chrome\//.test(ua)) return { name: "Chrome", chromium: true };
  if (/Safari\//.test(ua)) return { name: "Safari", chromium: false };
  return null;
}

const str = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;

export async function getDesktopInfo(): Promise<DesktopInfo | null> {
  try {
    const response = await fetch(`${API_URL}/api/pass/desktop`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = await response.json();
    const data = body?.data;
    if (!data || typeof data !== "object") return null;
    const downloads = (data.downloads ?? {}) as Record<string, unknown>;
    const extension = (data.extension ?? {}) as Record<string, unknown>;
    const stores = (extension.stores ?? {}) as Record<string, unknown>;
    return {
      version: str(data.version) ?? "",
      downloads: {
        windows: str(downloads.windows),
        macos: str(downloads.macos),
      },
      extension: {
        version: str(extension.version) ?? "",
        download: str(extension.download),
        stores: { chrome: str(stores.chrome), edge: str(stores.edge) },
      },
    };
  } catch {
    return null;
  }
}