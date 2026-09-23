import { useState } from "react";
import {
  ArrowLeft,
  Check,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import {
  login,
  verifyLoginCode,
  verifyTwoFactor,
  SessionError,
  type LoginStep,
  type Session,
} from "../lib/session";
import { openInBrowser, WEB_URL } from "../lib/tauri";
import {
  SecretInput,
  fieldClass,
  primaryButton,
} from "@/components/pass/PassUi";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Stage =
  | { kind: "credentials" }
  | { kind: "twoFactor"; userId: number; challenge: string }
  | { kind: "code"; userId: number; email: string };

export function LoginForm({
  onLoggedIn,
  compact = false,
}: {
  onLoggedIn: (session: Session) => void;
  compact?: boolean;
}) {
  const t = useT();
  const [stage, setStage] = useState<Stage>({ kind: "credentials" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fail = (err: unknown) => {
    if (err instanceof SessionError) setError(err.message);
    else if (err instanceof TypeError) setError(t("desktopApp.login.offline"));
    else setError(t("desktopApp.login.generic"));
  };

  const finish = (session: Session) => {
    setPassword("");
    setCode("");
    onLoggedIn(session);
  };

  const submitCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      const step: LoginStep = await login(email.trim(), password);
      if (step.type === "done") finish(step.session);
      else if (step.type === "twoFactor")
        setStage({
          kind: "twoFactor",
          userId: step.userId,
          challenge: step.challenge,
        });
      else setStage({ kind: "code", userId: step.userId, email: step.email });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || code.trim().length < 6 || stage.kind === "credentials") return;
    setBusy(true);
    setError("");
    try {
      const session =
        stage.kind === "twoFactor"
          ? await verifyTwoFactor(
              stage.userId,
              stage.challenge,
              code.trim(),
              remember,
            )
          : await verifyLoginCode(stage.userId, code.trim(), remember);
      finish(session);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const errorBox = error && (
    <p className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">
      {error}
    </p>
  );

  if (stage.kind !== "credentials") {
    const twoFactor = stage.kind === "twoFactor";
    return (
      <form
        onSubmit={submitCode}
        className={cn("space-y-3", !compact && "mx-auto max-w-sm")}
      >
        <div className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-bio-primary/15 text-bio-primary">
            {twoFactor ? (
              <ShieldCheck className="size-4" />
            ) : (
              <Mail className="size-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-white">
              {t(
                twoFactor
                  ? "desktopApp.login.twoFactorTitle"
                  : "desktopApp.login.codeTitle",
              )}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-white/45">
              {twoFactor
                ? t("desktopApp.login.twoFactorBody")
                : t("desktopApp.login.codeBody", { email: stage.email })}
            </p>
          </div>
        </div>
        {errorBox}
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/[^0-9a-zA-Z-]/g, "").slice(0, 12))
          }
          placeholder={t("desktopApp.login.code")}
          autoFocus
          className={cn(
            fieldClass,
            "text-center font-mono text-base tracking-[0.3em]",
          )}
        />
        <label className="flex cursor-pointer items-center gap-2.5 text-[12px] text-white/60">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 accent-bio-primary"
          />
          {t("desktopApp.login.remember")}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setStage({ kind: "credentials" });
              setCode("");
              setError("");
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-white/60 transition-colors duration-150 hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            {t("desktopApp.nav.back")}
          </button>
          <button
            type="submit"
            disabled={busy || code.trim().length < 6}
            className={`${primaryButton} flex-1`}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {t(busy ? "desktopApp.login.verifying" : "desktopApp.login.verify")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={submitCredentials}
      className={cn("space-y-3", !compact && "mx-auto max-w-sm")}
    >
      {errorBox}
      <div>
        <label className="block text-[12px] text-white/50">
          {t("desktopApp.login.email")}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          autoFocus
          spellCheck={false}
          className={`${fieldClass} mt-1.5`}
        />
      </div>
      <div>
        <label className="block text-[12px] text-white/50">
          {t("desktopApp.login.password")}
        </label>
        <div className="mt-1.5">
          <SecretInput
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={busy || !email.trim() || !password}
        className={`${primaryButton} w-full`}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <KeyRound className="size-4" />
        )}
        {t(busy ? "desktopApp.login.submitting" : "desktopApp.login.submit")}
      </button>
      <button
        type="button"
        onClick={() => openInBrowser(`${WEB_URL}/auth/register`)}
        className="block w-full text-center text-[11.5px] text-white/35 transition-colors duration-150 hover:text-white/70"
      >
        {t("desktopApp.login.register")}
      </button>
    </form>
  );
}