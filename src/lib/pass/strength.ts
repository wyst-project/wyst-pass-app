export type StrengthLevel = "vulnerable" | "weak" | "fair" | "strong";

const COMMON = new Set([
  "password",
  "123456",
  "12345678",
  "123456789",
  "qwerty",
  "azerty",
  "abc123",
  "111111",
  "000000",
  "iloveyou",
  "admin",
  "letmein",
  "welcome",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "master",
  "sunshine",
  "princess",
  "motdepasse",
  "soleil",
  "bonjour",
  "password1",
  "passw0rd",
  "qwerty123",
  "1234567890",
  "azerty123",
  "loulou",
  "chocolat",
]);

export function passwordStrength(password: string): {
  level: StrengthLevel;
  score: number;
  bits: number;
} {
  if (!password) return { level: "vulnerable", score: 0, bits: 0 };
  let alphabet = 0;
  if (/[a-z]/.test(password)) alphabet += 26;
  if (/[A-Z]/.test(password)) alphabet += 26;
  if (/[0-9]/.test(password)) alphabet += 10;
  if (/[^a-zA-Z0-9]/.test(password)) alphabet += 33;
  let bits = password.length * Math.log2(alphabet || 1);
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || COMMON.has(lower.replace(/[0-9!.]+$/, "")))
    bits = Math.min(bits, 10);
  if (/^(.)\1+$/.test(password)) bits = Math.min(bits, 8);
  if (
    /^(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|azer)/i.test(
      password,
    )
  )
    bits *= 0.6;
  if (/(.{2,})\1{2,}/.test(password)) bits *= 0.6;
  const level: StrengthLevel =
    bits < 30
      ? "vulnerable"
      : bits < 45
        ? "weak"
        : bits < 65
          ? "fair"
          : "strong";
  const score =
    level === "vulnerable"
      ? 1
      : level === "weak"
        ? 2
        : level === "fair"
          ? 3
          : 4;
  return { level, score, bits: Math.round(bits) };
}

export interface GeneratorOptions {
  length: number;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
}

export const DEFAULT_GENERATOR: GeneratorOptions = {
  length: 20,
  uppercase: true,
  digits: true,
  symbols: true,
};

const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*+-=?_";

export function generatePassword(options: GeneratorOptions): string {
  const length = Math.max(8, Math.min(64, Math.floor(options.length)));
  const sets = [LOWER];
  if (options.uppercase) sets.push(UPPER);
  if (options.digits) sets.push(DIGITS);
  if (options.symbols) sets.push(SYMBOLS);
  const all = sets.join("");
  const pick = (chars: string) =>
    chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const chars = sets.map(pick);
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}