import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  LogOut,
  Rocket,
  Settings2,
  Volume2,
} from "lucide-react";
import { ChoiceRow } from "../components/Wizard";
import { notify } from "../lib/notify";
import { logout, type Session } from "../lib/session";
import { readSettings, writeSettings, type Settings } from "../lib/settings";
import {
  onTrayLock,
  openInBrowser,
  setAutostart,
  setHideOnClose,
  useVaultWindow,
  useWizardWindow,
  WEB_URL,
} from "../lib/tauri";
import { AppSetup, AppUnlock } from "./Unlock";
import {
  PassWorkspace,
  type PassEventDetail,
} from "@/components/pass/PassWorkspace";
import {
  ModalShell,
  primaryButton,
  secondaryButton,
} from "@/components/pass/PassUi";
import { getUploadUrl } from "@/lib/api/config";
import { useT } from "@/lib/i18n";

export function Vault({
  session,
  onLoggedOut,
}: {
  session: Session;
  onLoggedOut: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const onEvent = (event: Event) => {
      const {
        type,
        kind,
        title = "",
      } = (event as CustomEvent<PassEventDetail>).detail;
      const open = {
        label: "desktopApp.notify.open" as const,
        run: "open" as const,
      };
      const vars = { title };
      switch (type) {
        case "autolocked":
          return void notify({
            kind: "lock",
            title: "desktopApp.notify.lockedTitle",
            body: "desktopApp.notify.lockedBody",
            action: open,
          });
        case "locked":
          return void notify({
            kind: "lock",
            title: "desktopApp.notify.lockedTitle",
            body: "desktopApp.notify.lockedManualBody",
            action: open,
          });
        case "vault-created":
          return void notify({
            kind: "success",
            title: "desktopApp.notify.vaultCreatedTitle",
            body: "desktopApp.notify.vaultCreatedBody",
          });
        case "item-created":
          return void notify({
            kind: "success",
            title:
              kind === "note"
                ? "desktopApp.notify.noteCreatedTitle"
                : kind === "card"
                  ? "desktopApp.notify.cardCreatedTitle"
                  : "desktopApp.notify.loginCreatedTitle",
            body: "desktopApp.notify.itemCreatedBody",
            vars,
          });
        case "item-deleted":
          return void notify({
            kind: "danger",
            title: "desktopApp.notify.itemDeletedTitle",
            body: "desktopApp.notify.itemDeletedBody",
            vars,
          });
        case "folder-created":
          return void notify({
            kind: "success",
            title: "desktopApp.notify.folderCreatedTitle",
            body: "desktopApp.notify.folderCreatedBody",
            vars,
          });
        case "folder-deleted":
          return void notify({
            kind: "danger",
            title: "desktopApp.notify.folderDeletedTitle",
            body: "desktopApp.notify.folderDeletedBody",
            vars,
          });
        default:
          return;
      }
    };
    window.addEventListener("wyst-pass:event", onEvent);
    return () => window.removeEventListener("wyst-pass:event", onEvent);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onTrayLock(() => window.dispatchEvent(new Event("wyst-pass:lock"))).then(
      (fn) => {
        unlisten = fn;
      },
    );
    return () => unlisten?.();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#050505] p-4">
      <PassWorkspace
        variant="app"
        userId={session.user.id}
        panelHeight="h-full min-h-0"
        accessory={
          <AccountMenu
            session={session}
            onSettings={() => setSettingsOpen(true)}
            onLoggedOut={onLoggedOut}
          />
        }
        renderSetup={(props) => <AppSetup {...props} />}
        renderUnlock={(props) => <AppUnlock {...props} />}
        onLockedChange={(locked) =>
          void (locked ? useWizardWindow() : useVaultWindow())
        }
      />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function AccountMenu({
  session,
  onSettings,
  onLoggedOut,
}: {
  session: Session;
  onSettings: () => void;
  onLoggedOut: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const sources = [
    session.user.avatar ? getUploadUrl(session.user.avatar) : null,
    session.user.discordAvatar || null,
  ].filter((s): s is string => Boolean(s));
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const avatar = sources.find((source) => !broken.has(source)) ?? null;
  const entry =
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-white/70 transition-colors duration-200 hover:bg-white/[0.05] hover:text-white";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-1.5 pr-2.5 text-[12.5px] font-medium text-white/70 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="size-6 rounded-md object-cover"
            onError={() => setBroken((current) => new Set(current).add(avatar))}
          />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-md bg-bio-primary/15 text-[11px] font-semibold text-bio-primary">
            {session.user.username.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="max-w-28 truncate">{session.user.username}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1.5 w-60 overflow-hidden rounded-lg border border-white/[0.1] bg-[#0c0c0c] p-1 shadow-2xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSettings();
              }}
              className={entry}
            >
              <Settings2 className="size-4 text-white/40" />
              {t("desktopApp.account.settings")}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                openInBrowser(`${WEB_URL}/dashboard/pass`);
              }}
              className={entry}
            >
              <ExternalLink className="size-4 text-white/40" />
              {t("desktopApp.account.dashboard")}
            </button>
            <div className="my-1 border-t border-white/[0.06]" />
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await logout();
                onLoggedOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-red-400 transition-colors duration-200 hover:bg-red-500/10"
            >
              <LogOut className="size-4" />
              {t("desktopApp.account.logout")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    readSettings().then(setSettings);
  }, []);

  const save = async () => {
    if (!settings || saving) return;
    setSaving(true);
    await setAutostart(settings.autostart);
    await setHideOnClose(settings.hideOnClose);
    await writeSettings(settings);
    if (settings.notifications)
      void notify({
        kind: "info",
        title: "desktopApp.notify.testTitle",
        body: "desktopApp.notify.testBody",
        sound: settings.notificationSound,
        durationMs: 4000,
      });
    setSaving(false);
    setSaved(true);
    setTimeout(onClose, 600);
  };

  return (
    <ModalShell
      onClose={onClose}
      icon={<Settings2 className="size-5" />}
      title={t("desktopApp.account.settings")}
    >
      {settings && (
        <div className="mt-5 space-y-2">
          <ChoiceRow
            icon={Rocket}
            label={t("desktopApp.options.autostart")}
            hint={t("desktopApp.options.autostartHint")}
            checked={settings.autostart}
            onChange={(v) => setSettings({ ...settings, autostart: v })}
          />
          <ChoiceRow
            icon={Download}
            label={t("desktopApp.options.tray")}
            hint={t("desktopApp.options.trayHint")}
            checked={settings.hideOnClose}
            onChange={(v) => setSettings({ ...settings, hideOnClose: v })}
          />
          <ChoiceRow
            icon={Bell}
            label={t("desktopApp.options.notifications")}
            hint={t("desktopApp.options.notificationsHint")}
            checked={settings.notifications}
            onChange={(v) => setSettings({ ...settings, notifications: v })}
          />
          <ChoiceRow
            icon={Volume2}
            label={t("desktopApp.options.sound")}
            hint={t("desktopApp.options.soundHint")}
            checked={settings.notificationSound}
            disabled={!settings.notifications}
            onChange={(v) => setSettings({ ...settings, notificationSound: v })}
          />
        </div>
      )}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className={`${secondaryButton} flex-1`}
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!settings || saving}
          className={`${primaryButton} flex-1`}
        >
          {saved && <Check className="size-4" />}
          {t(saved ? "desktopApp.account.saved" : "desktopApp.account.save")}
        </button>
      </div>
    </ModalShell>
  );
}