import { invoke } from "@tauri-apps/api/core";
import { systemLocale } from "./locale";
import { readSettings } from "./settings";
import { translate, type TranslationKey } from "@/lib/i18n";

export type NotifyKind =
  | "info"
  | "success"
  | "lock"
  | "danger"
  | "update"
  | "account";

export interface NotifyInput {
  kind?: NotifyKind;
  title: TranslationKey;
  body: TranslationKey;
  vars?: Record<string, string | number>;
  image?: string;
  action?: {
    label: TranslationKey;
    run: "open" | `http://${string}` | `https://${string}`;
  };
  sound?: boolean;
  durationMs?: number;
}

export async function notify(input: NotifyInput) {
  const settings = await readSettings();
  if (!settings.notifications) return;
  const locale = systemLocale();
  const t = (key: TranslationKey) => translate(locale, key, input.vars);
  try {
    await invoke("show_notification", {
      notification: {
        id: crypto.randomUUID(),
        kind: input.kind ?? "info",
        caption: `Wyst Pass · ${translate(locale, "desktopApp.notify.now")}`,
        title: t(input.title),
        body: t(input.body),
        image: input.image ?? null,
        actionLabel: input.action ? t(input.action.label) : null,
        action: input.action?.run ?? null,
        sound: input.sound ?? settings.notificationSound,
        durationMs: input.durationMs ?? 6500,
      },
    });
  } catch {}
}