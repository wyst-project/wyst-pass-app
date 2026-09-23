import { locale as osLocale } from "@tauri-apps/plugin-os";
import { DEFAULT_LOCALE, resolveLocale, type Locale } from "@/lib/i18n";

let system: Locale = DEFAULT_LOCALE;

export async function detectSystemLocale(): Promise<Locale> {
  try {
    const tag = await osLocale();
    system = resolveLocale(tag || navigator.language);
  } catch {
    system = resolveLocale(navigator.language);
  }
  return system;
}

export const systemLocale = () => system;