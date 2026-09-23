import { useEffect, useState } from "react";
import { Loader2, UserRound } from "lucide-react";
import { LoginForm } from "./components/LoginForm";
import { Titlebar } from "./components/Titlebar";
import { WizardFooter, WizardFrame, WizardPage } from "./components/Wizard";
import { Installer, type Step } from "./screens/Installer";
import { Uninstaller } from "./screens/Uninstaller";
import { Vault } from "./screens/Vault";
import { notify } from "./lib/notify";
import { readSession, refreshUser, type Session } from "./lib/session";
import { readSettings, writeSettings } from "./lib/settings";
import {
  getSetupStatus,
  setHideOnClose,
  startedMinimized,
  useVaultWindow,
  useWizardWindow,
  type SetupStatus,
} from "./lib/tauri";
import { isLocale, useI18n } from "@/lib/i18n";

type Screen =
  | { kind: "loading" }
  | {
      kind: "installer";
      session: Session | null;
      setup: SetupStatus;
      startAt?: Step;
    }
  | { kind: "uninstaller" }
  | { kind: "login"; expired: boolean }
  | { kind: "vault"; session: Session };

const FALLBACK_SETUP: SetupStatus = {
  mode: "installed",
  installDir: "",
  exePath: "",
  supported: false,
};

export default function App() {
  const { t, locale, setLocale } = useI18n();
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [booted, setBooted] = useState(false);
  const [setup, setSetup] = useState<SetupStatus>(FALLBACK_SETUP);

  useEffect(() => {
    if (booted) void writeSettings({ locale });
  }, [booted, locale]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await getSetupStatus().catch(() => FALLBACK_SETUP);
      setSetup(status);
      const settings = await readSettings();
      if (settings.locale && isLocale(settings.locale))
        setLocale(settings.locale);
      setBooted(true);

      if (status.mode === "uninstall") {
        await useWizardWindow();
        if (!cancelled) setScreen({ kind: "uninstaller" });
        return;
      }
      const stored = readSession();
      if (status.mode === "setup") {
        await useWizardWindow();
        if (!cancelled)
          setScreen({ kind: "installer", session: stored, setup: status });
        return;
      }

      await setHideOnClose(settings.hideOnClose);
      if (settings.justInstalled) {
        await writeSettings({ justInstalled: false });
        void notify({
          kind: "success",
          title: "desktopApp.notify.installedTitle",
          body: "desktopApp.notify.installedBody",
          action: { label: "desktopApp.notify.open", run: "open" },
        });
      } else if (await startedMinimized()) {
        void notify({
          kind: "info",
          title: "desktopApp.notify.trayTitle",
          body: "desktopApp.notify.trayBody",
          action: { label: "desktopApp.notify.open", run: "open" },
        });
      }
      if (!settings.setupDone) {
        await useWizardWindow();
        if (!cancelled)
          setScreen({ kind: "installer", session: stored, setup: status });
        return;
      }
      if (!stored) {
        await useWizardWindow();
        if (!cancelled) setScreen({ kind: "login", expired: false });
        return;
      }
      const user = await refreshUser();
      if (cancelled) return;
      if (!user) {
        await useWizardWindow();
        setScreen({ kind: "login", expired: true });
        void notify({
          kind: "account",
          title: "desktopApp.notify.expiredTitle",
          body: "desktopApp.notify.expiredBody",
          action: { label: "desktopApp.notify.open", run: "open" },
        });
        return;
      }
      if (!user.passUnlocked) {
        await useWizardWindow();
        setScreen({
          kind: "installer",
          session: { ...stored, user },
          setup: status,
          startAt: "done",
        });
        return;
      }
      await useVaultWindow();
      setScreen({ kind: "vault", session: { ...stored, user } });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openVault = async (session: Session) => {
    void notify({
      kind: "account",
      title: "desktopApp.notify.signedInTitle",
      body: "desktopApp.notify.signedInBody",
      vars: { username: session.user.username },
    });
    if (!session.user.passUnlocked) {
      await useWizardWindow();
      setScreen({ kind: "installer", session, setup, startAt: "done" });
      return;
    }
    await useVaultWindow();
    setScreen({ kind: "vault", session });
  };

  const toLogin = async () => {
    await useWizardWindow();
    setScreen({ kind: "login", expired: false });
  };

  return (
    <div className="flex h-full flex-col bg-[#050505] text-white">
      <Titlebar />
      {screen.kind === "loading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/40">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-[12px]">{t("desktopApp.session.checking")}</p>
        </div>
      )}
      {screen.kind === "installer" && (
        <Installer
          key={screen.startAt ?? "welcome"}
          session={screen.session}
          setup={screen.setup}
          startAt={screen.startAt}
          onFinished={openVault}
        />
      )}
      {screen.kind === "uninstaller" && <Uninstaller />}
      {screen.kind === "login" && (
        <WizardFrame>
          <WizardPage
            icon={UserRound}
            title={t("desktopApp.login.title")}
            footer={<WizardFooter />}
          >
            {screen.expired && (
              <p className="mb-3 rounded-md border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2 text-[12.5px] text-amber-200/90">
                {t("desktopApp.session.expired")}
              </p>
            )}
            <LoginForm compact onLoggedIn={openVault} />
          </WizardPage>
        </WizardFrame>
      )}
      {screen.kind === "vault" && (
        <Vault session={screen.session} onLoggedOut={toLogin} />
      )}
    </div>
  );
}