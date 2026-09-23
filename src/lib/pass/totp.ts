export interface TotpConfig {
  secret: string;
  digits: number;
  period: number;
  algorithm: "SHA-1" | "SHA-256" | "SHA-512";
  issuer: string;
  label: string;
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const normalizeSecret = (value: string) =>
  value.toUpperCase().replace(/[^A-Z2-7]/g, "");

export function base32Decode(secret: string): Uint8Array | null {
  const clean = normalizeSecret(secret);
  if (!clean) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return out.length ? new Uint8Array(out) : null;
}

export function parseTotp(input: string): TotpConfig | null {
  const raw = input.trim();
  if (!raw) return null;
  const config: TotpConfig = {
    secret: "",
    digits: 6,
    period: 30,
    algorithm: "SHA-1",
    issuer: "",
    label: "",
  };
  if (/^otpauth:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.host.toLowerCase() !== "totp") return null;
    config.secret = normalizeSecret(url.searchParams.get("secret") || "");
    const digits = Number(url.searchParams.get("digits"));
    if (digits === 6 || digits === 8) config.digits = digits;
    const period = Number(url.searchParams.get("period"));
    if (Number.isInteger(period) && period >= 15 && period <= 120)
      config.period = period;
    const algorithm = (url.searchParams.get("algorithm") || "")
      .toUpperCase()
      .replace("SHA", "SHA-")
      .replace("--", "-");
    if (algorithm === "SHA-256" || algorithm === "SHA-512")
      config.algorithm = algorithm;
    config.issuer = url.searchParams.get("issuer") || "";
    const label = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    config.label = label.includes(":")
      ? label.split(":").slice(1).join(":")
      : label;
    if (!config.issuer && label.includes(":"))
      config.issuer = label.split(":")[0];
  } else {
    config.secret = normalizeSecret(raw);
  }
  if (config.secret.length < 16 || !base32Decode(config.secret)) return null;
  return config;
}

export async function generateTotp(
  config: TotpConfig,
  now = Date.now(),
): Promise<{ code: string; remaining: number }> {
  const secret = base32Decode(config.secret);
  if (!secret) throw new Error("Invalid secret");
  const counter = Math.floor(now / 1000 / config.period);
  const message = new Uint8Array(8);
  let value = counter;
  for (let i = 7; i >= 0; i--) {
    message[i] = value & 0xff;
    value = Math.floor(value / 256);
  }
  const key = await crypto.subtle.importKey(
    "raw",
    secret.slice().buffer as ArrayBuffer,
    { name: "HMAC", hash: config.algorithm },
    false,
    ["sign"],
  );
  const hmac = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      message.slice().buffer as ArrayBuffer,
    ),
  );
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = String(binary % 10 ** config.digits).padStart(
    config.digits,
    "0",
  );
  const remaining = config.period - (Math.floor(now / 1000) % config.period);
  return { code, remaining };
}

export const formatTotpCode = (code: string) =>
  code.length === 6
    ? `${code.slice(0, 3)} ${code.slice(3)}`
    : `${code.slice(0, 4)} ${code.slice(4)}`;
