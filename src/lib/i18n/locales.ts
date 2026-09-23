export const LOCALES = ["en", "fr", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  pt: "Português",
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

export const resolveLocale = (tag?: string | null): Locale => {
  if (!tag) return DEFAULT_LOCALE;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(primary) ? primary : DEFAULT_LOCALE;
};

export const detectLocale = (acceptLanguage?: string | null): Locale => {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      return { tag, q: q ? Number(q.slice(2)) || 0 : 1, index };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { tag } of ranked) {
    const primary = tag.toLowerCase().split(/[-_]/)[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
};
