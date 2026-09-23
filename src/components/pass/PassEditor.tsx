"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Dices,
  Globe,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  Star,
  StickyNote,
  X,
} from "lucide-react";
import {
  emptyItem,
  type PassItemData,
  type PassItemKind,
} from "@/lib/pass/crypto";
import {
  findServiceByHost,
  hostOf,
  searchServices,
  serviceUrl,
} from "@/lib/pass/services";
import {
  DEFAULT_GENERATOR,
  generatePassword,
  type GeneratorOptions,
} from "@/lib/pass/strength";
import { formatTotpCode, generateTotp, parseTotp } from "@/lib/pass/totp";
import { ItemAvatar, ServiceIcon } from "./ServiceIcon";
import {
  ModalShell,
  SecretInput,
  StrengthMeter,
  fieldClass,
  primaryButton,
  secondaryButton,
} from "./PassUi";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export interface FolderOption {
  id: string;
  data: PassItemData;
  path: string;
}

const formatCardNumber = (value: string) =>
  value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();

const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2
    ? `${digits.slice(0, 2)}/${digits.slice(2)}`
    : digits;
};

export const cardBrand = (number: string): string => {
  const digits = number.replace(/\D/g, "");
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^(6011|65|64[4-9])/.test(digits)) return "Discover";
  if (/^35/.test(digits)) return "JCB";
  if (/^(30[0-5]|36|38)/.test(digits)) return "Diners Club";
  return "";
};

const normalizeUrl = (raw: string) =>
  /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

export function PassEditor({
  item,
  kind,
  folders,
  defaultFolderId = null,
  initial,
  onClose,
  onSave,
}: {
  item: PassItemData | null;
  kind: PassItemKind;
  folders: FolderOption[];
  defaultFolderId?: string | null;
  initial?: Partial<PassItemData>;
  onClose: () => void;
  onSave: (data: PassItemData) => Promise<void>;
}) {
  const t = useT();
  const editing = item !== null;
  const [data, setData] = useState<PassItemData>(
    () => item ?? { ...emptyItem(kind, defaultFolderId), ...initial },
  );
  const [websiteInput, setWebsiteInput] = useState("");
  const [generator, setGenerator] =
    useState<GeneratorOptions>(DEFAULT_GENERATOR);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof PassItemData>(key: K, value: PassItemData[K]) =>
    setData((d) => ({ ...d, [key]: value }));
  const totpConfig = data.totp.trim() ? parseTotp(data.totp) : null;
  const totpInvalid = data.totp.trim().length > 0 && !totpConfig;
  const isLogin = data.kind === "login";
  const isCard = data.kind === "card";

  const suggestions = useMemo(() => {
    if (!isLogin) return [];
    const query =
      websiteInput.trim() || (data.urls.length === 0 ? data.title : "");
    const known = new Set(data.urls.map(hostOf));
    return searchServices(query, 6).filter(
      (service) => !service.domains.some((domain) => known.has(domain)),
    );
  }, [isLogin, websiteInput, data.title, data.urls]);

  const addUrl = (raw: string) => {
    const url = normalizeUrl(raw.trim());
    if (!raw.trim() || data.urls.length >= 10 || data.urls.includes(url))
      return;
    set("urls", [...data.urls, url]);
    setWebsiteInput("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const title = data.title.trim();
    if (!title) {
      setError(t("pass.editor.titleRequired"));
      return;
    }
    if (totpInvalid) {
      setError(t("pass.editor.totpInvalid"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const pending = websiteInput.trim();
      const urls =
        pending && !data.urls.includes(normalizeUrl(pending))
          ? [...data.urls, normalizeUrl(pending)]
          : data.urls;
      await onSave({
        ...data,
        title,
        urls: urls.slice(0, 10),
        totp: totpConfig ? data.totp.trim() : "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pass.editor.generic"));
      setSaving(false);
    }
  };

  const titleKey = editing
    ? data.kind === "note"
      ? "pass.editor.editNote"
      : data.kind === "card"
        ? "pass.editor.editCard"
        : "pass.editor.editTitle"
    : data.kind === "note"
      ? "pass.editor.createNote"
      : data.kind === "card"
        ? "pass.editor.createCard"
        : "pass.editor.createTitle";
  const icon =
    data.kind === "note" ? (
      <StickyNote className="size-5" />
    ) : data.kind === "card" ? (
      <CreditCard className="size-5" />
    ) : (
      <KeyRound className="size-5" />
    );
  const brand = isCard ? cardBrand(data.cardNumber) : "";

  return (
    <ModalShell onClose={onClose} icon={icon} title={t(titleKey)} wide>
      <form onSubmit={submit} className="mt-5 space-y-4">
        {error && (
          <p className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-[13px] text-red-400">
            {error}
          </p>
        )}

        <div className="flex items-start gap-3">
          <ItemAvatar data={data} className="mt-6 size-12 text-base" />
          <div
            className={cn(
              "grid min-w-0 flex-1 gap-4",
              isLogin && "sm:grid-cols-2",
            )}
          >
            <div>
              <label className="block text-[13px] text-white/50">
                {t("pass.editor.title")}
              </label>
              <input
                type="text"
                value={data.title}
                onChange={(e) => set("title", e.target.value.slice(0, 100))}
                placeholder={t(
                  data.kind === "note"
                    ? "pass.editor.noteTitlePlaceholder"
                    : data.kind === "card"
                      ? "pass.editor.cardTitlePlaceholder"
                      : "pass.editor.titlePlaceholder",
                )}
                autoFocus
                className={`${fieldClass} mt-2`}
              />
            </div>
            {isLogin && (
              <div>
                <label className="block text-[13px] text-white/50">
                  {t("pass.editor.username")}
                </label>
                <input
                  type="text"
                  value={data.username}
                  onChange={(e) =>
                    set("username", e.target.value.slice(0, 200))
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className={`${fieldClass} mt-2`}
                />
              </div>
            )}
          </div>
        </div>

        {isLogin && (
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[13px] text-white/50">
                {t("pass.editor.password")}
              </label>
              <button
                type="button"
                onClick={() => {
                  setGeneratorOpen(true);
                  set("password", generatePassword(generator));
                }}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-bio-primary transition-colors duration-200 hover:text-white"
              >
                <Dices className="size-3.5" />
                {t("pass.editor.generate")}
              </button>
            </div>
            <div className="mt-2">
              <SecretInput
                value={data.password}
                onChange={(v) => set("password", v.slice(0, 500))}
                autoComplete="new-password"
                className="font-mono"
              />
            </div>
            <StrengthMeter password={data.password} />
            {generatorOpen && (
              <div className="mt-3 grid gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <label className="flex items-center gap-3 text-[12px] text-white/50">
                  <span className="w-16 shrink-0">
                    {t("pass.editor.length")}
                  </span>
                  <input
                    type="range"
                    min={8}
                    max={64}
                    value={generator.length}
                    onChange={(e) => {
                      const next = {
                        ...generator,
                        length: Number(e.target.value),
                      };
                      setGenerator(next);
                      set("password", generatePassword(next));
                    }}
                    className="flex-1 accent-bio-primary"
                  />
                  <span className="w-6 text-right tabular-nums text-white">
                    {generator.length}
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(["uppercase", "digits", "symbols"] as const).map(
                    (option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          const next = {
                            ...generator,
                            [option]: !generator[option],
                          };
                          setGenerator(next);
                          set("password", generatePassword(next));
                        }}
                        aria-pressed={generator[option]}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200",
                          generator[option]
                            ? "border-bio-primary/40 bg-bio-primary/[0.12] text-white"
                            : "border-white/[0.08] bg-white/[0.02] text-white/45 hover:text-white/80",
                        )}
                      >
                        {t(`pass.editor.${option}`)}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {isLogin && (
          <div>
            <label className="block text-[13px] text-white/50">
              {t("pass.editor.websites")}
            </label>
            <div className="mt-2 space-y-1.5">
              {data.urls.map((url) => {
                const service = findServiceByHost(hostOf(url));
                return (
                  <div
                    key={url}
                    className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    {service ? (
                      <span className="flex size-5 shrink-0 items-center justify-center text-white/70">
                        <ServiceIcon service={service} className="size-4" />
                      </span>
                    ) : (
                      <Globe className="size-4 shrink-0 text-white/30" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px] text-white/80">
                      {url}
                    </span>
                    {service && (
                      <span className="hidden shrink-0 text-[11px] text-white/35 sm:block">
                        {service.name}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "urls",
                          data.urls.filter((u) => u !== url),
                        )
                      }
                      className="flex size-6 shrink-0 items-center justify-center rounded text-white/30 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-400"
                      aria-label={t("pass.detail.delete")}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              })}
              {data.urls.length < 10 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={websiteInput}
                    onChange={(e) =>
                      setWebsiteInput(e.target.value.slice(0, 300))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addUrl(websiteInput);
                      }
                    }}
                    placeholder={t("pass.editor.websitePlaceholder")}
                    autoComplete="off"
                    spellCheck={false}
                    className={fieldClass}
                  />
                  <button
                    type="button"
                    onClick={() => addUrl(websiteInput)}
                    className={`${secondaryButton} shrink-0 px-3`}
                    title={t("pass.editor.addWebsite")}
                    aria-label={t("pass.editor.addWebsite")}
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              )}
              {suggestions.length > 0 && data.urls.length < 10 && (
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
                  <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/30">
                    {t("pass.editor.suggestions")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          addUrl(serviceUrl(service));
                          if (!data.title.trim()) set("title", service.name);
                        }}
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] pl-2 pr-2.5 text-[12px] font-medium text-white/70 transition-colors duration-200 hover:border-bio-primary/40 hover:bg-bio-primary/[0.08] hover:text-white"
                      >
                        <ServiceIcon service={service} className="size-3.5" />
                        {service.name}
                        <span className="text-white/30">
                          {service.domains[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isLogin && (
          <div>
            <label className="block text-[13px] text-white/50">
              {t("pass.editor.totp")}
            </label>
            <input
              type="text"
              value={data.totp}
              onChange={(e) => set("totp", e.target.value.slice(0, 500))}
              placeholder={t("pass.editor.totpPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                fieldClass,
                "mt-2 font-mono",
                totpInvalid && "border-red-500/50",
              )}
            />
            {totpInvalid ? (
              <p className="mt-1.5 text-[11px] text-red-400">
                {t("pass.editor.totpInvalid")}
              </p>
            ) : totpConfig ? (
              <TotpPreview totp={data.totp} />
            ) : (
              <p className="mt-1.5 text-[11px] text-white/30">
                {t("pass.editor.totpHint")}
              </p>
            )}
          </div>
        )}

        {isCard && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-[13px] text-white/50">
                {t("pass.editor.cardHolder")}
              </label>
              <input
                type="text"
                value={data.cardHolder}
                onChange={(e) =>
                  set("cardHolder", e.target.value.slice(0, 100))
                }
                autoComplete="off"
                spellCheck={false}
                className={`${fieldClass} mt-2`}
              />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[13px] text-white/50">
                  {t("pass.editor.cardNumber")}
                </label>
                {brand && (
                  <span className="text-[11px] font-medium text-white/40">
                    {brand}
                  </span>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={data.cardNumber}
                onChange={(e) =>
                  set("cardNumber", formatCardNumber(e.target.value))
                }
                placeholder="0000 0000 0000 0000"
                autoComplete="off"
                spellCheck={false}
                className={`${fieldClass} mt-2 font-mono tracking-wider`}
              />
            </div>
            <div>
              <label className="block text-[13px] text-white/50">
                {t("pass.editor.cardExpiry")}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={data.cardExpiry}
                onChange={(e) =>
                  set("cardExpiry", formatExpiry(e.target.value))
                }
                placeholder="MM/YY"
                autoComplete="off"
                className={`${fieldClass} mt-2 font-mono`}
              />
            </div>
            <div>
              <label className="block text-[13px] text-white/50">
                {t("pass.editor.cardCvv")}
              </label>
              <div className="mt-2">
                <SecretInput
                  value={data.cardCvv}
                  onChange={(v) =>
                    set("cardCvv", v.replace(/\D/g, "").slice(0, 4))
                  }
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-[13px] text-white/50">
            {t("pass.editor.note")}
          </label>
          <textarea
            value={data.note}
            onChange={(e) => set("note", e.target.value.slice(0, 5000))}
            rows={data.kind === "note" ? 8 : 3}
            placeholder={
              data.kind === "note"
                ? t("pass.editor.notePlaceholder")
                : undefined
            }
            className="mt-2 w-full resize-none rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white transition-colors duration-200 placeholder:text-white/25 focus:border-bio-primary/50 focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="block text-[13px] text-white/50">
              {t("pass.editor.folder")}
            </label>
            <select
              value={data.folderId ?? ""}
              onChange={(e) => set("folderId", e.target.value || null)}
              className={cn(fieldClass, "mt-2 appearance-none bg-[#0c0c0c]")}
            >
              <option value="">{t("pass.editor.noFolder")}</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.path}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => set("favorite", !data.favorite)}
            aria-pressed={data.favorite}
            className={cn(
              "flex h-10 items-center gap-2 rounded-md border px-3 text-[13px] font-medium transition-colors duration-200",
              data.favorite
                ? "border-amber-400/40 bg-amber-400/[0.12] text-amber-300"
                : "border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-white/80",
            )}
          >
            <Star className={cn("size-4", data.favorite && "fill-current")} />
            {t("pass.editor.favorite")}
          </button>
        </div>

        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-white/30">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-emerald-400/70" />
          {t("pass.encryptedNote")}
        </p>

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
            disabled={saving}
            className={`${primaryButton} flex-1`}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t(
              saving
                ? "pass.editor.saving"
                : editing
                  ? "pass.editor.save"
                  : "pass.editor.create",
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function TotpPreview({
  totp,
  large = false,
}: {
  totp: string;
  large?: boolean;
}) {
  const [state, setState] = useState<{
    code: string;
    remaining: number;
    period: number;
  } | null>(null);
  const config = parseTotp(totp);
  const secret = config?.secret ?? "";
  const period = config?.period ?? 30;
  const digits = config?.digits ?? 6;
  const algorithm = config?.algorithm ?? "SHA-1";

  useEffect(() => {
    if (!secret) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await generateTotp({
          secret,
          period,
          digits,
          algorithm,
          issuer: "",
          label: "",
        });
        if (!cancelled) setState({ ...next, period });
      } catch {
        if (!cancelled) setState(null);
      }
    };
    void tick();
    const timer = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [secret, period, digits, algorithm]);

  if (!config) return null;
  const ratio = state ? state.remaining / state.period : 1;
  const size = large ? 32 : 24;
  const stroke = large ? 3 : 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const urgent = state ? state.remaining <= 5 : false;

  return (
    <div className={cn("mt-2 flex items-center gap-3", large && "mt-0")}>
      <span
        className={cn(
          "font-mono tabular-nums text-white",
          large
            ? "text-2xl font-semibold tracking-wider"
            : "text-[15px] font-semibold tracking-wider",
        )}
      >
        {state ? formatTotpCode(state.code) : "··· ···"}
      </span>
      <span
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={urgent ? "#f87171" : "#34d399"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <span
          className={cn(
            "absolute font-medium tabular-nums",
            large ? "text-[10px]" : "text-[8px]",
            urgent ? "text-red-300" : "text-white/60",
          )}
        >
          {state?.remaining ?? ""}
        </span>
      </span>
    </div>
  );
}