import { useEffect, useState } from "react";
import { ArrowUpRight, Minus, X } from "lucide-react";
import {
  appVersion,
  close,
  isMac,
  minimize,
  openInBrowser,
} from "../lib/tauri";
import { notify } from "../lib/notify";
import { getDesktopInfo } from "@/lib/pass/desktop";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

let notifiedUpdate = false;

const newer = (remote: string, local: string) => {
  const a = remote.split(".").map(Number);
  const b = local.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
};

export function Titlebar() {
  const t = useT();
  const mac = isMac();
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<{ version: string; url: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await appVersion();
      if (cancelled) return;
      setVersion(local);
      const info = await getDesktopInfo();
      if (cancelled || !info?.version || !newer(info.version, local)) return;
      const url = info.downloads[mac ? "macos" : "windows"];
      if (!url) return;
      setUpdate({ version: info.version, url });
      if (!notifiedUpdate) {
        notifiedUpdate = true;
        void notify({
          kind: "update",
          title: "desktopApp.notify.updateTitle",
          body: "desktopApp.notify.updateBody",
          vars: { version: info.version },
          action: {
            label: "desktopApp.notify.download",
            run: url as `https://${string}`,
          },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mac]);

  const control =
    "flex h-full w-11 items-center justify-center text-white/45 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white";

  return (
    <header
      data-tauri-drag-region
      className={cn(
        "wyst-titlebar flex h-9 shrink-0 select-none items-center border-b border-white/[0.06] bg-[#070707]",
        mac && "pl-[78px]",
      )}
    >
      <img
        src="/wicon.png"
        alt=""
        draggable={false}
        className="ml-3 size-4 rounded-[4px] opacity-70"
        data-tauri-drag-region
      />
      <span
        data-tauri-drag-region
        className="ml-2 text-[12.5px] font-semibold text-white/85"
      >
        Wyst Pass
      </span>
      {version && (
        <span
          data-tauri-drag-region
          className="ml-1.5 text-[11px] text-white/30"
        >
          v{version}
        </span>
      )}
      {update && (
        <button
          type="button"
          onClick={() => openInBrowser(update.url)}
          className="ml-3 inline-flex h-6 items-center gap-1 rounded-md border border-bio-primary/30 bg-bio-primary/10 px-2 text-[11px] font-medium text-bio-primary transition-colors duration-150 hover:bg-bio-primary/20"
        >
          {t("desktopApp.titlebar.update", { version: update.version })}
          <ArrowUpRight className="size-3" />
        </button>
      )}
      <span data-tauri-drag-region className="flex-1" />
      <LanguageSwitcher direction="down" align="right" className="mr-1" />
      {!mac && (
        <div className="flex h-full items-stretch">
          <button
            type="button"
            onClick={() => minimize()}
            title={t("desktopApp.titlebar.minimize")}
            aria-label={t("desktopApp.titlebar.minimize")}
            className={control}
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => close()}
            title={t("desktopApp.titlebar.close")}
            aria-label={t("desktopApp.titlebar.close")}
            className={cn(control, "hover:bg-red-500/80 hover:text-white")}
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </header>
  );
}