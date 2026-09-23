"use client";

import { useState } from "react";
import {
  CalendarClock,
  History,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  TimerReset,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  createPassVault,
  deletePassVault,
  rewrapPassVault,
  type PassVaultInfo,
} from "@/lib/api/pass";
import { createVault, rewrapVault, unlockVault } from "@/lib/pass/crypto";
import {
  ModalShell,
  SecretInput,
  StrengthMeter,
  fieldClass,
  primaryButton,
  secondaryButton,
} from "./PassUi";
import Grainient from "@/components/Grainient";
import { cn } from "@/lib/utils";
import { useI18n, useT } from "@/lib/i18n";

const MASTER_MIN = 10;

export function VaultSetup({
  onCreated,
}: {
  onCreated: (vault: PassVaultInfo, key: CryptoKey) => void;
}) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const tooShort = password.length > 0 && password.length < MASTER_MIN;
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
    <section className="mx-auto max-w-xl rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-white/[0.01] p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-bio-primary/10 text-bio-primary ring-1 ring-inset ring-bio-primary/20">
        <ShieldCheck className="size-6" />
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-white">
        {t("pass.setup.title")}
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">
        {t("pass.setup.body")}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && (
          <p className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-[13px] text-red-400">
            {error}
          </p>
        )}
        <div>
          <label className="block text-[13px] text-white/50">
            {t("pass.setup.master")}
          </label>
          <div className="mt-2">
            <SecretInput
              value={password}
              onChange={setPassword}
              placeholder={t("pass.setup.placeholder")}
              autoFocus
              autoComplete="new-password"
            />
          </div>
          <StrengthMeter password={password} />
          {tooShort && (
            <p className="mt-1.5 text-[11px] text-red-400">
              {t("pass.setup.short")}
            </p>
          )}
        </div>
        <div>
          <label className="block text-[13px] text-white/50">
            {t("pass.setup.confirm")}
          </label>
          <div className="mt-2">
            <SecretInput
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
          </div>
          {mismatch && (
            <p className="mt-1.5 text-[11px] text-red-400">
              {t("pass.setup.mismatch")}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3">
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-amber-200/90">
            <TriangleAlert className="mt-px size-4 shrink-0 text-amber-400" />
            {t("pass.setup.warning")}
          </p>
          <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 text-[12px] text-white/70">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="size-4 shrink-0 accent-bio-primary"
            />
            {t("pass.setup.check")}
          </label>
        </div>
        <button
          type="submit"
          disabled={!canCreate}
          className={`${primaryButton} w-full`}
        >
          {creating && <Loader2 className="size-4 animate-spin" />}
          {t(creating ? "pass.setup.creating" : "pass.setup.submit")}
        </button>
      </form>
    </section>
  );
}

export function VaultUnlock({
  vault,
  onUnlocked,
  onDelete,
  panelHeight = "lg:min-h-[calc(100vh-13.5rem)]",
}: {
  vault: PassVaultInfo;
  onUnlocked: (key: CryptoKey) => void;
  onDelete: () => void;
  panelHeight?: string;
}) {
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
  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(value))
      : "";

  const stats = [
    {
      icon: KeyRound,
      label: t("pass.unlock.stats.items"),
      value: number.format(vault.items),
    },
    {
      icon: History,
      label: t("pass.unlock.stats.lastChange"),
      value: vault.lastItemAt
        ? formatDate(vault.lastItemAt)
        : t("pass.unlock.stats.none"),
    },
    {
      icon: CalendarClock,
      label: t("pass.unlock.stats.created"),
      value: formatDate(vault.createdAt) || t("pass.unlock.stats.none"),
    },
    {
      icon: ShieldCheck,
      label: t("pass.unlock.stats.encryption"),
      value: "AES-256-GCM",
      hint: t("pass.unlock.stats.rounds", {
        rounds: number.format(vault.iterations),
      }),
    },
  ];

  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]",
        panelHeight,
      )}
    >
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-14 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <Grainient
            color1="#e8628f"
            color2="#5c1230"
            color3="#bf3664"
            timeSpeed={0.2}
            warpStrength={1}
            warpFrequency={5}
            warpSpeed={1.6}
            warpAmplitude={50}
            blendSoftness={0.05}
            rotationAmount={500}
            noiseScale={2}
            grainAmount={0.12}
            grainScale={2}
            contrast={1.35}
            gamma={1}
            saturation={1}
            zoom={0.9}
            className="opacity-70"
          />
          <div className="absolute inset-0 bg-[#0a0a0a]/55" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        </div>
        <div className="relative w-full max-w-sm">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-bio-primary/10 text-bio-primary ring-1 ring-inset ring-bio-primary/25">
            <LockKeyhole className="size-8" />
          </span>
          <h2 className="mt-5 text-center text-2xl font-semibold tracking-tight text-white">
            {t("pass.unlock.title")}
          </h2>
          <p className="mt-2 text-center text-[13px] leading-relaxed text-white/50">
            {t("pass.unlock.body")}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-3">
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

          <p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-white/30">
            <TimerReset className="size-3.5 shrink-0" />
            {t("pass.unlock.autoLock")}
          </p>

          <div className="mt-8 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <p className="text-[12px] font-medium text-white/60">
              {t("pass.unlock.forgot")}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/35">
              {t("pass.unlock.forgotBody")}
            </p>
            <button
              type="button"
              onClick={onDelete}
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 text-[12px] font-medium text-red-400 transition-colors duration-200 hover:bg-red-500/[0.12]"
            >
              <Trash2 className="size-3.5" />
              {t("pass.settings.delete")}
            </button>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 border-t border-white/[0.06] sm:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={cn(
              "flex items-start gap-3 px-5 py-4",
              index % 2 === 1 && "border-l border-white/[0.06]",
              index >= 2 && "border-t border-white/[0.06] sm:border-t-0",
              index === 2 && "sm:border-l",
            )}
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-white/45 ring-1 ring-inset ring-white/[0.08]">
              <stat.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-white/35">
                {stat.label}
              </dt>
              <dd className="mt-0.5 truncate text-[14px] font-semibold text-white">
                {stat.value}
              </dd>
              {stat.hint && (
                <dd className="truncate text-[11px] text-white/35">
                  {stat.hint}
                </dd>
              )}
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ChangeMasterModal({
  vault,
  onClose,
  onChanged,
}: {
  vault: PassVaultInfo;
  onClose: () => void;
  onChanged: (vault: PassVaultInfo, key: CryptoKey) => void;
}) {
  const t = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canSave =
    current.length > 0 &&
    next.length >= MASTER_MIN &&
    confirm === next &&
    !saving;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError("");
    const key = await unlockVault(current, vault);
    if (!key) {
      setError(t("pass.unlock.wrong"));
      setSaving(false);
      return;
    }
    try {
      const material = await rewrapVault(key, next);
      const updated = await rewrapPassVault(material);
      onChanged(updated, key);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pass.editor.generic"));
      setSaving(false);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      icon={<KeyRound className="size-5" />}
      title={t("pass.settings.change")}
    >
      <form onSubmit={submit} className="mt-5 space-y-4">
        {error && (
          <p className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-[13px] text-red-400">
            {error}
          </p>
        )}
        <div>
          <label className="block text-[13px] text-white/50">
            {t("pass.settings.current")}
          </label>
          <div className="mt-2">
            <SecretInput
              value={current}
              onChange={setCurrent}
              autoFocus
              autoComplete="current-password"
            />
          </div>
        </div>
        <div>
          <label className="block text-[13px] text-white/50">
            {t("pass.settings.next")}
          </label>
          <div className="mt-2">
            <SecretInput
              value={next}
              onChange={setNext}
              placeholder={t("pass.setup.placeholder")}
              autoComplete="new-password"
            />
          </div>
          <StrengthMeter password={next} />
        </div>
        <div>
          <label className="block text-[13px] text-white/50">
            {t("pass.setup.confirm")}
          </label>
          <div className="mt-2">
            <SecretInput
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
          </div>
          {confirm && confirm !== next && (
            <p className="mt-1.5 text-[11px] text-red-400">
              {t("pass.setup.mismatch")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`${secondaryButton} flex-1`}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className={`${primaryButton} flex-1`}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t(saving ? "pass.editor.saving" : "pass.editor.save")}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function DeleteVaultModal({
  onClose,
  onDeleted,
}: {
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await deletePassVault(password);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pass.editor.generic"));
      setDeleting(false);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      icon={<Trash2 className="size-5" />}
      title={t("pass.settings.delete")}
    >
      <p className="mt-2 flex items-start gap-2 text-[13px] leading-relaxed text-white/55">
        <TriangleAlert className="mt-px size-4 shrink-0 text-amber-400" />
        {t("pass.settings.deleteBody")}
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        {error && (
          <p className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-[13px] text-red-400">
            {error}
          </p>
        )}
        <div>
          <label className="block text-[13px] text-white/50">
            {t("pass.settings.accountPassword")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className={`${fieldClass} mt-2`}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`${secondaryButton} flex-1`}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={!password || deleting}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-red-500 text-[13px] font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting && <Loader2 className="size-4 animate-spin" />}
            {t(deleting ? "pass.remove.deleting" : "pass.remove.confirm")}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}