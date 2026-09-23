import { useState } from "react";
import {
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type {
  WorkspaceSetupProps,
  WorkspaceUnlockProps,
} from "@/components/pass/PassWorkspace";
import {
  SecretInput,
  StrengthMeter,
  primaryButton,
} from "@/components/pass/PassUi";
import { createPassVault } from "@/lib/api/pass";
import { createVault, unlockVault } from "@/lib/pass/crypto";
import { useI18n, useT } from "@/lib/i18n";

const MASTER_MIN = 10;
export function AppUnlock({
  vault,
  onUnlocked,
  onDelete,
}: WorkspaceUnlockProps) {
  const t = useT();
  const { locale } = useI18n();
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [wrong, setWrong] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || unlocking) return;
    setUnlocking(true);
    setWrong(false);
    const key = await unlockVault(password, vault);
    if (!key) {
      setWrong(true);
      setUnlocking(false);
      return;
    }
    setPassword("");
    onUnlocked(key);
  };

  const number = new Intl.NumberFormat(locale);
  const created = vault.createdAt
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(vault.createdAt))
    : "";

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-8">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-bio-primary/10 text-bio-primary ring-1 ring-inset ring-bio-primary/25">
        <LockKeyhole className="size-7" />
      </span>
      <h1 className="mt-4 text-[20px] font-semibold tracking-tight text-white">
        {t("pass.unlock.title")}
      </h1>
      <p className="mt-1 text-[12.5px] text-white/50">
        {t("pass.unlock.body")}
      </p>
      <form onSubmit={submit} className="mt-5 w-full max-w-xs space-y-2.5">
        <SecretInput
          value={password}
          onChange={setPassword}
          placeholder={t("pass.setup.master")}
          autoFocus
          autoComplete="current-password"
          className={wrong ? "border-red-500/50" : undefined}
        />
        {wrong && (
          <p className="text-center text-[12px] text-red-400">
            {t("pass.unlock.wrong")}
          </p>
        )}
        <button
          type="submit"
          disabled={!password || unlocking}
          className={`${primaryButton} w-full`}
        >
          {unlocking && <Loader2 className="size-4 animate-spin" />}
          {t(unlocking ? "pass.unlock.unlocking" : "pass.unlock.submit")}
        </button>
      </form>
      <p className="mt-4 text-[11px] text-white/30">
        {t("pass.items", { count: number.format(vault.items) })}
        {created && (
          <span>
            {" "}
            · {t("pass.unlock.stats.created")} {created}
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={onDelete}
        className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-white/35 transition-colors duration-150 hover:text-red-400"
      >
        <Trash2 className="size-3" />
        {t("pass.unlock.forgot")} {t("pass.settings.delete")}
      </button>
    </div>
  );
}

export function AppSetup({ onCreated }: WorkspaceSetupProps) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const mismatch = confirm.length > 0 && confirm !== password;
  const canCreate =
    password.length >= MASTER_MIN &&
    confirm === password &&
    understood &&
    !creating;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    setError("");
    try {
      const { vaultKey, material } = await createVault(password);
      const vault = await createPassVault(material);
      onCreated(vault, vaultKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pass.editor.generic"));
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bio-primary/10 text-bio-primary ring-1 ring-inset ring-bio-primary/25">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-white">
            {t("pass.setup.title")}
          </h1>
          <p className="text-[12px] text-white/50">{t("pass.setup.body")}</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-4 w-full max-w-sm space-y-2.5">
        {error && (
          <p className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
            {error}
          </p>
        )}
        <div>
          <SecretInput
            value={password}
            onChange={setPassword}
            placeholder={t("pass.setup.placeholder")}
            autoFocus
            autoComplete="new-password"
          />
          <StrengthMeter password={password} />
        </div>
        <SecretInput
          value={confirm}
          onChange={setConfirm}
          placeholder={t("pass.setup.confirm")}
          autoComplete="new-password"
          className={mismatch ? "border-red-500/50" : undefined}
        />
        <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-amber-400/25 bg-amber-400/[0.06] p-2.5 text-[11.5px] leading-snug text-amber-200/90">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="mt-0.5 size-3.5 shrink-0 accent-bio-primary"
          />
          <span>
            <TriangleAlert className="mr-1 inline size-3 text-amber-400" />
            {t("pass.setup.warning")} {t("pass.setup.check")}
          </span>
        </label>
        <button
          type="submit"
          disabled={!canCreate}
          className={`${primaryButton} w-full`}
        >
          {creating && <Loader2 className="size-4 animate-spin" />}
          {t(creating ? "pass.setup.creating" : "pass.setup.submit")}
        </button>
      </form>
    </div>
  );
}