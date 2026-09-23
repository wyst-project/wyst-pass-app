import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  CircleAlert,
  Download,
  FolderOpen,
  HardDriveDownload,
  KeyRound,
  Link2,
  LockKeyhole,
  PartyPopper,
  Rocket,
  ScrollText,
  Settings2,
  ShieldCheck,
  TimerReset,
  UserRound,
  X,
} from "lucide-react";
import { LoginForm } from "../components/LoginForm";
import {
  ChoiceRow,
  ProgressBar,
  WizardFooter,
  WizardFrame,
  WizardPage,
  type Direction,
} from "../components/Wizard";
import { refreshUser, type Session } from "../lib/session";
import { readSettings, writeSettings, type Settings } from "../lib/settings";
import {
  installApp,
  launchInstalled,
  onInstallProgress,
  openInBrowser,
  setAutostart,
  setHideOnClose,
  WEB_URL,
  type InstallProgress,
  type SetupStatus,
} from "../lib/tauri";
import { getDesktopInfo } from "@/lib/pass/desktop";
import { useT, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type Step =
  | "welcome"
  | "install"
  | "installing"
  | "login"
  | "options"
  | "apply"
  | "done";

type LogState = "pending" | "running" | "ok" | "missing" | "skipped" | "failed";
interface LogLine {
  key: string;
  state: LogState;
  detail?: string;
}

const APPLY_KEYS = [
  "api",
  "account",
  "pass",
  "autostart",
  "tray",
  "done",
] as const;
const INSTALL_KEYS = ["copy", "shortcuts", "registry", "autostart"] as const;

const pending = (keys: readonly string[]): LogLine[] =>
  keys.map((key) => ({ key, state: "pending" }));

export function Installer({
  session: initialSession,
  setup,
  startAt = "welcome",
  onFinished,
}: {
  session: Session | null;
  setup: SetupStatus;
  startAt?: Step;
  onFinished: (session: Session) => void;
}) {
  const t = useT();
  const setupMode = setup.mode === "setup";
  const order: Step[] = setupMode
    ? ["welcome", "install", "installing", "login", "options", "apply", "done"]
    : ["welcome", "login", "options", "apply", "done"];
  const [step, setStep] = useState<Step>(startAt);
  const [direction, setDirection] = useState<Direction>("forward");
  const [terms, setTerms] = useState(false);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [install, setInstall] = useState({
    desktopShortcut: true,
    startMenu: true,
  });
  const [installLines, setInstallLines] = useState<LogLine[]>(
    pending(INSTALL_KEYS),
  );
  const [installError, setInstallError] = useState("");
  const [installed, setInstalled] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [hasPass, setHasPass] = useState<boolean | null>(
    initialSession ? Boolean(initialSession.user.passUnlocked) : null,
  );
  const [busy, setBusy] = useState(false);
  const ranApply = useRef(false);
  const ranInstall = useRef(false);

  useEffect(() => {
    readSettings().then((saved) => {
      setSettings(saved);
      setTerms(saved.termsAccepted);
    });
  }, []);

  const go = (next: Step) => {
    setDirection(
      order.indexOf(next) > order.indexOf(step) ? "forward" : "back",
    );
    setStep(next);
  };
  const after = (current: Step) => order[order.indexOf(current) + 1];
  const before = (current: Step) => order[order.indexOf(current) - 1];

  const update = (patch: Partial<Settings>) =>
    setSettings((current) => (current ? { ...current, ...patch } : current));

  const runInstall = async () => {
    if (!settings || ranInstall.current) return;
    ranInstall.current = true;
    setBusy(true);
    setInstallError("");
    setInstallLines(pending(INSTALL_KEYS));
    const unlisten = await onInstallProgress((event: InstallProgress) => {
      setInstallLines((current) =>
        current.map((line) =>
          line.key === event.step
            ? { ...line, state: event.state, detail: event.detail }
            : line,
        ),
      );
      const index = INSTALL_KEYS.indexOf(
        event.step as (typeof INSTALL_KEYS)[number],
      );
      if (index >= 0 && event.state !== "running")
        setProgress(Math.round(((index + 1) / INSTALL_KEYS.length) * 100));
    });
    try {
      await installApp({
        desktopShortcut: install.desktopShortcut,
        startMenu: install.startMenu,
        autostart: settings.autostart,
      });
      setInstalled(true);
      setProgress(100);
    } catch (err) {
      setInstallError(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : t("desktopApp.login.generic"),
      );
      setInstallLines((current) =>
        current.map((line) =>
          line.state === "running" ? { ...line, state: "failed" } : line,
        ),
      );
      ranInstall.current = false;
    } finally {
      unlisten();
      setBusy(false);
    }
  };

  const runApply = async () => {
    if (!settings || !session || ranApply.current) return;
    ranApply.current = true;
    setBusy(true);
    let current = pending(APPLY_KEYS);
    const set = (key: string, state: LogState) => {
      current = current.map((line) =>
        line.key === key ? { ...line, state } : line,
      );
      setLines(current);
    };
    const tick = (index: number) =>
      setProgress(Math.round(((index + 1) / APPLY_KEYS.length) * 100));
    const pause = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    setProgress(0);
    setLines(current);

    set("api", "running");
    const info = await getDesktopInfo();
    await pause(350);
    set("api", info ? "ok" : "failed");
    tick(0);

    set("account", "running");
    const user = await refreshUser();
    await pause(350);
    set("account", user ? "ok" : "failed");
    tick(1);
    if (user) setSession({ ...session, user });

    set("pass", "running");
    await pause(300);
    const unlocked = Boolean(user?.passUnlocked);
    setHasPass(unlocked);
    set("pass", unlocked ? "ok" : "missing");
    tick(2);

    set("autostart", "running");
    await setAutostart(settings.autostart);
    await pause(300);
    set("autostart", settings.autostart ? "ok" : "skipped");
    tick(3);

    set("tray", "running");
    await setHideOnClose(settings.hideOnClose);
    await pause(250);
    set("tray", settings.hideOnClose ? "ok" : "skipped");
    tick(4);

    await writeSettings({ ...settings, termsAccepted: true, setupDone: true });
    set("done", "ok");
    tick(5);
    setBusy(false);
  };

  useEffect(() => {
    if (step === "installing") void runInstall();
    if (step === "apply") void runApply();
  }, [step]);

  const recheck = async () => {
    if (!session) return;
    const user = await refreshUser();
    if (user) {
      setSession({ ...session, user });
      setHasPass(Boolean(user.passUnlocked));
    }
  };

  const finish = async () => {
    if (!session) return;
    if (setupMode && installed) {
      await writeSettings({ justInstalled: true });
      await launchInstalled();
      return;
    }
    onFinished(session);
  };

  const logColor = (state: LogState) =>
    state === "ok"
      ? "text-emerald-400"
      : state === "failed"
        ? "text-red-400"
        : state === "missing"
          ? "text-amber-300"
          : "text-white/35";

  const renderLog = (entries: LogLine[], prefix: "install" | "apply") => (
    <ul className="mt-4 space-y-1.5 font-mono text-[12px]">
      {entries.map((line) => (
        <li key={line.key} className="flex items-center gap-2.5">
          <LogMark state={line.state} />
          <span
            className={cn(
              "truncate",
              line.state === "pending" ? "text-white/25" : "text-white/75",
            )}
          >
            {t(
              (prefix === "install"
                ? `desktopApp.setup.steps.${line.key}`
                : `desktopApp.install.steps.${line.key}`) as TranslationKey,
            )}
          </span>
          {line.state !== "pending" && line.state !== "running" && (
            <span
              className={cn(
                "ml-auto shrink-0 text-[11px]",
                logColor(line.state),
              )}
            >
              {t(`desktopApp.install.${line.state}`)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <WizardFrame>
      {step === "welcome" && (
        <WizardPage
          icon={ScrollText}
          title={t("desktopApp.welcome.title")}
          direction={direction}
          footer={
            <WizardFooter
              onNext={() => go(after("welcome"))}
              nextDisabled={!terms}
            />
          }
        >
          <p className="text-[13px] leading-relaxed text-white/60">
            {t("desktopApp.welcome.body")}
          </p>
          <ul className="mt-4 space-y-2">
            {(
              [
                ["same", KeyRound],
                ["zero", ShieldCheck],
                ["tray", TimerReset],
              ] as const
            ).map(([key, Icon]) => (
              <li
                key={key}
                className="flex items-start gap-2.5 text-[12.5px] text-white/75"
              >
                <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-md bg-bio-primary/15 text-bio-primary">
                  <Icon className="size-3" />
                </span>
                {t(`desktopApp.welcome.points.${key}`)}
              </li>
            ))}
          </ul>
          <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 text-[12.5px] text-white/75">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-bio-primary"
            />
            <span>
              {t("desktopApp.welcome.terms")}
              <button
                type="button"
                onClick={() =>
                  openInBrowser(`${WEB_URL}/help/general/policies-security`)
                }
                className="ml-1.5 text-bio-primary hover:underline"
              >
                {t("desktopApp.welcome.termsLink")}
              </button>
            </span>
          </label>
        </WizardPage>
      )}

      {step === "install" && settings && (
        <WizardPage
          icon={HardDriveDownload}
          title={t("desktopApp.setup.title")}
          direction={direction}
          footer={
            <WizardFooter
              onBack={() => go("welcome")}
              onNext={() => go("installing")}
              nextLabel={t("desktopApp.setup.install")}
            />
          }
        >
          <p className="mb-3 text-[12.5px] text-white/50">
            {t("desktopApp.setup.body")}
          </p>
          <div className="space-y-2">
            <ChoiceRow
              icon={Link2}
              label={t("desktopApp.setup.startMenu")}
              hint={t("desktopApp.setup.startMenuHint")}
              checked={install.startMenu}
              onChange={(v) => setInstall({ ...install, startMenu: v })}
            />
            <ChoiceRow
              icon={Link2}
              label={t("desktopApp.setup.desktopShortcut")}
              hint={t("desktopApp.setup.desktopShortcutHint")}
              checked={install.desktopShortcut}
              onChange={(v) => setInstall({ ...install, desktopShortcut: v })}
            />
            <ChoiceRow
              icon={Rocket}
              label={t("desktopApp.options.autostart")}
              hint={t("desktopApp.options.autostartHint")}
              checked={settings.autostart}
              onChange={(v) => update({ autostart: v })}
            />
          </div>
          <p className="mt-3 flex items-center gap-2 text-[11.5px] text-white/35">
            <FolderOpen className="size-3.5 shrink-0" />
            <span className="truncate" data-selectable>
              {t("desktopApp.setup.location", { dir: setup.installDir })}
            </span>
          </p>
        </WizardPage>
      )}

      {step === "installing" && (
        <WizardPage
          icon={Download}
          title={t("desktopApp.setup.installingTitle")}
          direction={direction}
          footer={
            <WizardFooter
              onBack={busy ? undefined : () => go("install")}
              onNext={
                busy
                  ? undefined
                  : installed
                    ? () => go("login")
                    : () => void runInstall()
              }
              nextLabel={installed ? undefined : t("desktopApp.done.retry")}
              busy={busy}
            />
          }
        >
          <p className="mb-4 text-[12.5px] text-white/50">
            {t("desktopApp.setup.installingBody")}
          </p>
          <ProgressBar
            value={progress}
            state={installError ? "error" : installed ? "done" : "running"}
          />
          {renderLog(installLines, "install")}
          {installError && (
            <p
              className="mt-3 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-400"
              data-selectable
            >
              {installError}
            </p>
          )}
        </WizardPage>
      )}

      {step === "login" && (
        <WizardPage
          icon={UserRound}
          title={t("desktopApp.login.title")}
          direction={direction}
          footer={
            <WizardFooter
              onBack={setupMode ? undefined : () => go(before("login"))}
              onNext={() => go("options")}
              nextDisabled={!session}
            />
          }
        >
          {session ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
                <Check className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-white">
                  {t("desktopApp.login.loggedIn", {
                    username: session.user.username,
                  })}
                </p>
                <button
                  type="button"
                  onClick={() => setSession(null)}
                  className="mt-0.5 text-[11.5px] text-white/45 transition-colors duration-150 hover:text-white/80"
                >
                  {t("desktopApp.login.change")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3 text-[12.5px] text-white/50">
                {t("desktopApp.login.body")}
              </p>
              <LoginForm compact onLoggedIn={setSession} />
            </>
          )}
        </WizardPage>
      )}

      {step === "options" && settings && (
        <WizardPage
          icon={Settings2}
          title={t("desktopApp.options.title")}
          direction={direction}
          footer={
            <WizardFooter
              onBack={() => go("login")}
              onNext={() => go("apply")}
            />
          }
        >
          <p className="mb-3 text-[12.5px] text-white/50">
            {t("desktopApp.options.body")}
          </p>
          <div className="space-y-2">
            {!setupMode && (
              <ChoiceRow
                icon={Rocket}
                label={t("desktopApp.options.autostart")}
                hint={t("desktopApp.options.autostartHint")}
                checked={settings.autostart}
                onChange={(v) => update({ autostart: v })}
              />
            )}
            <ChoiceRow
              icon={Download}
              label={t("desktopApp.options.tray")}
              hint={t("desktopApp.options.trayHint")}
              checked={settings.hideOnClose}
              onChange={(v) => update({ hideOnClose: v })}
            />
            <ChoiceRow
              icon={Bell}
              label={t("desktopApp.options.notifications")}
              hint={t("desktopApp.options.notificationsHint")}
              checked={settings.notifications}
              onChange={(v) => update({ notifications: v })}
            />
            <ChoiceRow
              icon={LockKeyhole}
              label={t("desktopApp.options.lock")}
              hint={t("desktopApp.options.lockHint")}
              checked
              disabled
            />
          </div>
        </WizardPage>
      )}

      {step === "apply" && (
        <WizardPage
          icon={Download}
          title={t("desktopApp.install.title")}
          direction={direction}
          footer={
            <WizardFooter
              onBack={busy ? undefined : () => go("options")}
              onNext={busy ? undefined : () => go("done")}
              busy={busy}
            />
          }
        >
          <p className="mb-4 text-[12.5px] text-white/50">
            {t("desktopApp.install.body")}
          </p>
          <ProgressBar
            value={progress}
            state={
              lines.some((l) => l.state === "failed")
                ? "error"
                : progress >= 100
                  ? "done"
                  : "running"
            }
          />
          {renderLog(lines, "apply")}
        </WizardPage>
      )}

      {step === "done" && (
        <WizardPage
          icon={hasPass ? PartyPopper : CircleAlert}
          title={t(
            hasPass ? "desktopApp.done.title" : "desktopApp.done.noPassTitle",
          )}
          direction={direction}
          footer={
            hasPass ? (
              <WizardFooter
                onBack={() => go("apply")}
                onNext={() => void finish()}
                nextLabel={t(
                  setupMode && installed
                    ? "desktopApp.setup.launch"
                    : "desktopApp.nav.open",
                )}
              />
            ) : (
              <WizardFooter
                onBack={() => go("apply")}
                onNext={recheck}
                nextLabel={t("desktopApp.done.retry")}
              />
            )
          }
        >
          <p className="text-[13px] leading-relaxed text-white/60">
            {t(
              hasPass
                ? setupMode && installed
                  ? "desktopApp.setup.doneBody"
                  : "desktopApp.done.body"
                : "desktopApp.done.noPassBody",
            )}
          </p>
          {!hasPass && (
            <button
              type="button"
              onClick={() =>
                openInBrowser(`${WEB_URL}/dashboard/shop?item=pass`)
              }
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-bio-primary px-4 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-bio-primary/90"
            >
              <LockKeyhole className="size-4" />
              {t("desktopApp.done.buy")}
            </button>
          )}
        </WizardPage>
      )}
    </WizardFrame>
  );
}

function LogMark({ state }: { state: LogState }) {
  if (state === "ok")
    return (
      <Check className="size-3.5 shrink-0 text-emerald-400" strokeWidth={3} />
    );
  if (state === "failed")
    return <X className="size-3.5 shrink-0 text-red-400" strokeWidth={3} />;
  if (state === "missing")
    return <CircleAlert className="size-3.5 shrink-0 text-amber-300" />;
  if (state === "running")
    return (
      <span className="size-3.5 shrink-0 animate-pulse rounded-full bg-bio-primary" />
    );
  return (
    <span
      className={cn(
        "size-3.5 shrink-0 rounded-full border",
        state === "skipped" ? "border-white/20" : "border-white/10",
      )}
    />
  );
}