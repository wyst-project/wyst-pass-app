import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { openInBrowser, WEB_URL } from "../lib/tauri";

export type Direction = "forward" | "back";

export function WizardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#050505]">
      <div className="relative flex min-h-0 flex-1 flex-col p-5">
        {children}
      </div>
    </div>
  );
}

export function WizardPage({
  icon: Icon,
  title,
  direction = "forward",
  children,
  footer,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  direction?: Direction;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <section
      key={title}
      data-direction={direction}
      className="wizard-page flex min-h-0 flex-1 flex-col"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-md bg-bio-primary/15 text-bio-primary ring-1 ring-inset ring-bio-primary/30">
          <Icon className="size-4" />
        </span>
        <h1 className="text-[16px] font-semibold tracking-tight text-white">
          {title}
        </h1>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
      {footer}
    </section>
  );
}

export function WizardFooter({
  onBack,
  onNext,
  backLabel,
  nextLabel,
  backDisabled = false,
  nextDisabled = false,
  busy = false,
}: {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  busy?: boolean;
}) {
  const t = useT();
  return (
    <footer className="mt-4 flex shrink-0 items-end justify-between gap-3">
      <div className="flex items-center gap-3 text-[11px] text-white/30">
        <button
          type="button"
          onClick={() => openInBrowser(WEB_URL)}
          className="transition-colors duration-150 hover:text-white/70"
        >
          wyst.lol
        </button>
        <button
          type="button"
          onClick={() => openInBrowser("https://discord.gg/wyst")}
          className="transition-colors duration-150 hover:text-white/70"
        >
          Discord
        </button>
        <button
          type="button"
          onClick={() =>
            openInBrowser(`${WEB_URL}/help/how-to-guides/wyst-pass`)
          }
          className="transition-colors duration-150 hover:text-white/70"
        >
          Docs
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack || backDisabled}
          className="h-8 rounded-md border border-white/[0.08] bg-white/[0.03] px-3.5 text-[12.5px] font-medium text-white/65 transition-colors duration-150 hover:border-white/[0.16] hover:text-white disabled:pointer-events-none disabled:opacity-40"
        >
          {backLabel ?? t("desktopApp.nav.back")}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext || nextDisabled || busy}
          className="inline-flex h-8 items-center gap-2 rounded-md bg-bio-primary px-4 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-bio-primary/90 disabled:pointer-events-none disabled:opacity-40"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {nextLabel ?? t("desktopApp.nav.next")}
        </button>
      </div>
    </footer>
  );
}

export function ChoiceRow({
  icon: Icon,
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  checked: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  const toggle = Boolean(onChange) && !disabled;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={!toggle}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors duration-150",
        checked
          ? "border-bio-primary/40 bg-bio-primary/[0.1]"
          : "border-white/[0.06] bg-white/[0.03]",
        toggle && "hover:border-white/[0.14]",
        !toggle && "cursor-default",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          checked
            ? "bg-bio-primary/20 text-bio-primary"
            : "bg-white/[0.05] text-white/45",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[13px] font-medium",
            checked ? "text-white" : "text-white/80",
          )}
        >
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[11.5px] leading-snug text-white/40">
            {hint}
          </span>
        )}
      </span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150",
          checked
            ? "border-bio-primary bg-bio-primary text-white"
            : "border-white/[0.15] bg-transparent text-transparent",
        )}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    </button>
  );
}

export function ProgressBar({
  value,
  state = "running",
}: {
  value: number | null;
  state?: "running" | "done" | "error";
}) {
  return (
    <div
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]",
        value === null && "progress-indeterminate",
      )}
    >
      {value !== null && (
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            state === "error"
              ? "bg-red-500"
              : state === "done"
                ? "bg-emerald-400"
                : "bg-bio-primary",
          )}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      )}
    </div>
  );
}