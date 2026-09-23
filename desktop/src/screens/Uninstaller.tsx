import { useEffect, useRef, useState } from "react";
import { Check, Database, Trash2, X } from "lucide-react";
import {
  ChoiceRow,
  ProgressBar,
  WizardFooter,
  WizardFrame,
  WizardPage,
  type Direction,
} from "../components/Wizard";
import {
  exitApp,
  onInstallProgress,
  uninstallApp,
  type InstallProgress,
} from "../lib/tauri";
import { useT, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Step = "confirm" | "removing" | "done";
const KEYS = ["shortcuts", "registry", "files"] as const;
type LineState = "pending" | "running" | "ok" | "failed";

export function Uninstaller() {
  const t = useT();
  const [step, setStep] = useState<Step>("confirm");
  const [direction, setDirection] = useState<Direction>("forward");
  const [removeData, setRemoveData] = useState(false);
  const [lines, setLines] = useState<{ key: string; state: LineState }[]>(
    KEYS.map((key) => ({ key, state: "pending" })),
  );
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  const run = async () => {
    if (ran.current) return;
    ran.current = true;
    setBusy(true);
    const unlisten = await onInstallProgress((event: InstallProgress) => {
      setLines((current) =>
        current.map((line) =>
          line.key === event.step
            ? { ...line, state: event.state === "skipped" ? "ok" : event.state }
            : line,
        ),
      );
      const index = KEYS.indexOf(event.step as (typeof KEYS)[number]);
      if (index >= 0 && event.state !== "running")
        setProgress(Math.round(((index + 1) / KEYS.length) * 100));
    });
    try {
      await uninstallApp(removeData);
      setProgress(100);
      setDirection("forward");
      setStep("done");
    } catch (err) {
      setError(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : t("desktopApp.login.generic"),
      );
      ran.current = false;
    } finally {
      unlisten();
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step === "removing") void run();
  }, [step]);

  return (
    <WizardFrame>
      {step === "confirm" && (
        <WizardPage
          icon={Trash2}
          title={t("desktopApp.uninstall.title")}
          direction={direction}
          footer={
            <WizardFooter
              onBack={() => void exitApp()}
              backLabel={t("common.cancel")}
              onNext={() => {
                setDirection("forward");
                setStep("removing");
              }}
              nextLabel={t("desktopApp.uninstall.confirm")}
            />
          }
        >
          <p className="text-[13px] leading-relaxed text-white/60">
            {t("desktopApp.uninstall.body")}
          </p>
          <div className="mt-4">
            <ChoiceRow
              icon={Database}
              label={t("desktopApp.uninstall.removeData")}
              hint={t("desktopApp.uninstall.removeDataHint")}
              checked={removeData}
              onChange={setRemoveData}
            />
          </div>
        </WizardPage>
      )}

      {step === "removing" && (
        <WizardPage
          icon={Trash2}
          title={t("desktopApp.uninstall.removingTitle")}
          direction={direction}
          footer={
            <WizardFooter
              busy={busy}
              onNext={busy || !error ? undefined : () => void run()}
              nextLabel={t("desktopApp.done.retry")}
            />
          }
        >
          <ProgressBar value={progress} state={error ? "error" : "running"} />
          <ul className="mt-4 space-y-1.5 font-mono text-[12px]">
            {lines.map((line) => (
              <li key={line.key} className="flex items-center gap-2.5">
                {line.state === "ok" ? (
                  <Check
                    className="size-3.5 shrink-0 text-emerald-400"
                    strokeWidth={3}
                  />
                ) : line.state === "failed" ? (
                  <X
                    className="size-3.5 shrink-0 text-red-400"
                    strokeWidth={3}
                  />
                ) : line.state === "running" ? (
                  <span className="size-3.5 shrink-0 animate-pulse rounded-full bg-bio-primary" />
                ) : (
                  <span className="size-3.5 shrink-0 rounded-full border border-white/10" />
                )}
                <span
                  className={cn(
                    line.state === "pending"
                      ? "text-white/25"
                      : "text-white/75",
                  )}
                >
                  {t(
                    `desktopApp.uninstall.steps.${line.key}` as TranslationKey,
                  )}
                </span>
              </li>
            ))}
          </ul>
          {error && (
            <p
              className="mt-3 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-400"
              data-selectable
            >
              {error}
            </p>
          )}
        </WizardPage>
      )}

      {step === "done" && (
        <WizardPage
          icon={Check}
          title={t("desktopApp.uninstall.doneTitle")}
          direction={direction}
          footer={
            <WizardFooter
              onNext={() => void exitApp()}
              nextLabel={t("desktopApp.uninstall.quit")}
            />
          }
        >
          <p className="text-[13px] leading-relaxed text-white/60">
            {t("desktopApp.uninstall.doneBody")}
          </p>
        </WizardPage>
      )}
    </WizardFrame>
  );
}