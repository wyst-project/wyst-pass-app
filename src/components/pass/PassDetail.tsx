"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Folder,
  Globe,
  KeyRound,
  Mail,
  Pencil,
  ShieldCheck,
  Star,
  StickyNote,
  Trash2,
  User,
} from "lucide-react";
import type { PassItemData } from "@/lib/pass/crypto";
import { findServiceByHost, hostOf } from "@/lib/pass/services";
import { generateTotp, parseTotp } from "@/lib/pass/totp";
import { TotpPreview, cardBrand } from "./PassEditor";
import { CopyButton, StrengthPill } from "./PassUi";
import {
  FOLDER_ICONS,
  ItemAvatar,
  ServiceIcon,
  folderColor,
} from "./ServiceIcon";
import { cn } from "@/lib/utils";
import { useI18n, useT } from "@/lib/i18n";

export interface DecryptedItem {
  id: string;
  data: PassItemData;
  createdAt: string | null;
  updatedAt: string | null;
}

const maskCard = (number: string) => {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 4) return "•••• ••••";
  return `•••• •••• •••• ${digits.slice(-4)}`;
};

export function PassDetail({
  item,
  folder,
  readOnly = false,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  item: DecryptedItem;
  folder: DecryptedItem | null;
  readOnly?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [shown, setShown] = useState(false);
  const [cardShown, setCardShown] = useState(false);
  const [cvvShown, setCvvShown] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const { data } = item;
  const totpConfig = data.totp ? parseTotp(data.totp) : null;

  useEffect(() => {
    if (!totpConfig) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await generateTotp(totpConfig);
        if (!cancelled) setTotpCode(next.code);
      } catch {}
    };
    void tick();
    const timer = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [data.totp]);

  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(value))
      : "";

  const FolderIcon = folder ? (FOLDER_ICONS[folder.data.icon] ?? Folder) : null;
  const brand = data.kind === "card" ? cardBrand(data.cardNumber) : "";
  const subtitle =
    data.kind === "login"
      ? data.username
      : data.kind === "card"
        ? brand || data.cardHolder
        : "";
  const hasFields =
    data.kind === "login"
      ? Boolean(data.username || data.password || totpConfig)
      : data.kind === "card";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <ItemAvatar data={data} className="size-11 text-base" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">
              {data.title}
            </h2>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-white/40">
              {subtitle && <span className="truncate">{subtitle}</span>}
              {folder && FolderIcon && (
                <span
                  className="inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[11px] font-medium"
                  style={{
                    color: folderColor(folder.data.color),
                    borderColor: `${folderColor(folder.data.color)}40`,
                  }}
                >
                  <FolderIcon className="size-3" />
                  {folder.data.title}
                </span>
              )}
            </div>
          </div>
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5",
            readOnly && "hidden",
          )}
        >
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={data.favorite}
            title={t(
              data.favorite ? "pass.detail.unfavorite" : "pass.detail.favorite",
            )}
            aria-label={t(
              data.favorite ? "pass.detail.unfavorite" : "pass.detail.favorite",
            )}
            className={cn(
              "flex size-8 items-center justify-center rounded-md border transition-colors duration-200",
              data.favorite
                ? "border-amber-400/40 bg-amber-400/[0.12] text-amber-300"
                : "border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-amber-300",
            )}
          >
            <Star className={cn("size-3.5", data.favorite && "fill-current")} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] font-medium text-white/70 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
          >
            <Pencil className="size-3.5" />
            {t("pass.detail.edit")}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title={t("pass.detail.delete")}
            aria-label={t("pass.detail.delete")}
            className="flex size-8 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/50 transition-colors duration-200 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {hasFields && (
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
            {data.kind === "login" && data.username && (
              <Row
                icon={<Mail className="size-4" />}
                label={t("pass.detail.username")}
                action={<CopyButton value={data.username} />}
              >
                <span className="truncate text-[14px] text-white">
                  {data.username}
                </span>
              </Row>
            )}
            {data.kind === "login" && data.password && (
              <Row
                icon={<KeyRound className="size-4" />}
                label={t("pass.detail.password")}
                action={
                  <>
                    <StrengthPill password={data.password} />
                    <RevealButton
                      shown={shown}
                      onToggle={() => setShown((s) => !s)}
                    />
                    <CopyButton value={data.password} />
                  </>
                }
              >
                <span
                  className={cn(
                    "truncate font-mono text-[14px] text-white",
                    !shown && "tracking-[0.2em]",
                  )}
                >
                  {shown
                    ? data.password
                    : "•".repeat(
                        Math.min(14, Math.max(8, data.password.length)),
                      )}
                </span>
              </Row>
            )}
            {data.kind === "login" && totpConfig && (
              <Row
                icon={<ShieldCheck className="size-4" />}
                label={t("pass.detail.totp")}
                action={<CopyButton value={totpCode} />}
              >
                <TotpPreview totp={data.totp} large />
              </Row>
            )}

            {data.kind === "card" && data.cardHolder && (
              <Row
                icon={<User className="size-4" />}
                label={t("pass.detail.cardHolder")}
                action={<CopyButton value={data.cardHolder} />}
              >
                <span className="truncate text-[14px] text-white">
                  {data.cardHolder}
                </span>
              </Row>
            )}
            {data.kind === "card" && data.cardNumber && (
              <Row
                icon={<CreditCard className="size-4" />}
                label={
                  brand
                    ? `${t("pass.detail.cardNumber")} · ${brand}`
                    : t("pass.detail.cardNumber")
                }
                action={
                  <>
                    <RevealButton
                      shown={cardShown}
                      onToggle={() => setCardShown((s) => !s)}
                    />
                    <CopyButton value={data.cardNumber.replace(/\s/g, "")} />
                  </>
                }
              >
                <span className="truncate font-mono text-[14px] tracking-wider text-white">
                  {cardShown ? data.cardNumber : maskCard(data.cardNumber)}
                </span>
              </Row>
            )}
            {data.kind === "card" && data.cardExpiry && (
              <Row
                icon={<CalendarDays className="size-4" />}
                label={t("pass.detail.cardExpiry")}
                action={<CopyButton value={data.cardExpiry} />}
              >
                <span className="font-mono text-[14px] text-white">
                  {data.cardExpiry}
                </span>
              </Row>
            )}
            {data.kind === "card" && data.cardCvv && (
              <Row
                icon={<KeyRound className="size-4" />}
                label={t("pass.detail.cardCvv")}
                action={
                  <>
                    <RevealButton
                      shown={cvvShown}
                      onToggle={() => setCvvShown((s) => !s)}
                    />
                    <CopyButton value={data.cardCvv} />
                  </>
                }
              >
                <span className="font-mono text-[14px] tracking-[0.2em] text-white">
                  {cvvShown ? data.cardCvv : "•".repeat(data.cardCvv.length)}
                </span>
              </Row>
            )}
          </div>
        )}

        {data.kind === "login" && data.urls.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-white/35">
              <Globe className="size-3.5" />
              {t("pass.detail.websites")}
            </p>
            <div className="mt-2 space-y-1.5">
              {data.urls.map((url) => {
                const service = findServiceByHost(hostOf(url));
                return (
                  <div
                    key={url}
                    className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2"
                  >
                    {service && (
                      <span className="flex size-5 shrink-0 items-center justify-center text-white/60">
                        <ServiceIcon service={service} className="size-3.5" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px] text-bio-primary">
                      {url}
                    </span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t("pass.detail.open")}
                      aria-label={t("pass.detail.open")}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-white/40 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                    <CopyButton value={url} className="size-7" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {data.note && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
            <p className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-white/35">
              <span className="flex items-center gap-2">
                <StickyNote className="size-3.5" />
                {t("pass.detail.note")}
              </span>
              <CopyButton value={data.note} className="size-7" />
            </p>
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-white/75">
              {data.note}
            </p>
          </div>
        )}

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 text-[12px] text-white/40">
          <p className="flex items-center gap-2">
            <Clock className="size-3.5" />
            <span>{t("pass.detail.modified")}</span>
            <span className="ml-auto text-white/60">
              {formatDate(item.updatedAt)}
            </span>
          </p>
          <p className="mt-1.5 flex items-center gap-2">
            <Clock className="size-3.5 opacity-0" />
            <span>{t("pass.detail.created")}</span>
            <span className="ml-auto text-white/60">
              {formatDate(item.createdAt)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function RevealButton({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      title={t(shown ? "pass.detail.hide" : "pass.detail.show")}
      aria-label={t(shown ? "pass.detail.hide" : "pass.detail.show")}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-white/40 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
    >
      {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}

function Row({
  icon,
  label,
  action,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/40">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-white/35">
          {label}
        </p>
        <div className="mt-0.5 flex min-w-0 items-center">{children}</div>
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-1">{action}</div>
      )}
    </div>
  );
}