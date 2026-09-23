"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, X } from "lucide-react";
import { passwordStrength, type StrengthLevel } from "@/lib/pass/strength";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export const fieldClass =
  "h-10 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white transition-colors duration-200 placeholder:text-white/25 focus:border-bio-primary/50 focus:outline-none";

export const primaryButton =
  "flex h-10 items-center justify-center gap-2 rounded-md bg-bio-primary px-4 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-bio-primary/90 disabled:cursor-not-allowed disabled:opacity-40";

export const secondaryButton =
  "flex h-10 items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-4 text-[13px] font-medium text-white/60 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export function SecretInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  autoComplete = "off",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  className?: string;
}) {
  const t = useT();
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        spellCheck={false}
        className={cn(fieldClass, "pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        title={t(shown ? "pass.detail.hide" : "pass.detail.show")}
        aria-label={t(shown ? "pass.detail.hide" : "pass.detail.show")}
        className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-white/35 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

const STRENGTH_TONE: Record<StrengthLevel, { bar: string; text: string }> = {
  vulnerable: { bar: "bg-red-500", text: "text-red-400" },
  weak: { bar: "bg-orange-400", text: "text-orange-300" },
  fair: { bar: "bg-amber-300", text: "text-amber-200" },
  strong: { bar: "bg-emerald-400", text: "text-emerald-400" },
};

export function StrengthMeter({ password }: { password: string }) {
  const t = useT();
  if (!password) return null;
  const { level, score } = passwordStrength(password);
  const tone = STRENGTH_TONE[level];
  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-200",
              step <= score ? tone.bar : "bg-white/[0.08]",
            )}
          />
        ))}
      </div>
      <span
        className={cn("w-20 text-right text-[11px] font-medium", tone.text)}
      >
        {t(`pass.strength.${level}`)}
      </span>
    </div>
  );
}

export function StrengthPill({ password }: { password: string }) {
  const t = useT();
  if (!password) return null;
  const { level } = passwordStrength(password);
  const tone = STRENGTH_TONE[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-medium",
        tone.text,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.bar)} />
      {t(`pass.strength.${level}`)}
    </span>
  );
}

export function CopyButton({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {}
      }}
      title={t(copied ? "pass.detail.copied" : "pass.detail.copy")}
      aria-label={t(copied ? "pass.detail.copied" : "pass.detail.copy")}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md text-white/40 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white",
        copied && "text-emerald-400",
        className,
      )}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

export function ModalShell({
  onClose,
  icon,
  title,
  wide = false,
  children,
}: {
  onClose: () => void;
  icon: React.ReactNode;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-in fade-in zoom-in-95 relative max-h-[92vh] w-full overflow-y-auto rounded-xl border border-white/[0.08] bg-[#0c0c0c] p-5 shadow-2xl duration-200",
          wide ? "max-w-xl" : "max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-white/30 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white/70"
        >
          <X className="size-4" />
        </button>
        <span className="flex size-11 items-center justify-center rounded-lg bg-bio-primary/10 text-bio-primary ring-1 ring-inset ring-bio-primary/20">
          {icon}
        </span>
        <h2 className="mt-4 text-base font-semibold text-white">{title}</h2>
        {children}
      </div>
    </div>
  );
}
