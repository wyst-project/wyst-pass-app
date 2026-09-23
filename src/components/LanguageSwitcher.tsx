"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";
import { LOCALES, LOCALE_NAMES, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function LanguageSwitcher({
  className,
  align = "right",
  direction = "up",
}: {
  className?: string;
  align?: "left" | "right";
  direction?: "up" | "down";
}) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`${t("common.language")} · ${LOCALE_NAMES[locale]}`}
        aria-label={t("common.language")}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex size-8 items-center justify-center rounded-md text-white/35 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white/80",
          open && "bg-white/[0.06] text-white/80",
        )}
      >
        <Languages className="size-4" />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 min-w-40 rounded-lg border border-white/[0.08] bg-[#0c0c0c] p-1 shadow-2xl",
            align === "right" ? "right-0" : "left-0",
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {LOCALES.map((code) => {
            const active = code === locale;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors duration-200",
                  active
                    ? "bg-white/[0.06] text-white"
                    : "text-white/60 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "w-7 rounded border px-1 py-px text-center font-mono text-[10px] font-semibold uppercase tracking-wide",
                    active
                      ? "border-bio-primary/30 bg-bio-primary/10 text-bio-primary"
                      : "border-white/[0.08] bg-white/[0.03] text-white/40",
                  )}
                >
                  {code}
                </span>
                <span className="flex-1 text-left">{LOCALE_NAMES[code]}</span>
                {active && <Check className="size-3.5 text-bio-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}