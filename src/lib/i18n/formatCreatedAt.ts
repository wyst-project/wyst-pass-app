import type { Dictionary } from "./dictionaries";
import type { Locale } from "./locales";

type JoinedKey = `profile.joined.${keyof Dictionary["profile"]["joined"]}`;

export const formatCreatedAt = (
  dateString: string | undefined,
  style: string = "relative",
  t: (key: JoinedKey, vars?: Record<string, string | number>) => string,
  locale: Locale
): string => {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
  const year = date.getFullYear();
  const fullDate = `${day} ${month} ${year}`;

  switch (style) {
    case "relative": {
      if (diffDays === 0) return t("profile.joined.today");
      if (diffDays === 1) return t("profile.joined.yesterday");
      if (diffDays < 7) return t("profile.joined.daysAgo", { count: diffDays });
      const diffWeeks = Math.floor(diffDays / 7);
      if (diffWeeks === 1) return t("profile.joined.weekAgo");
      if (diffWeeks < 4) return t("profile.joined.weeksAgo", { count: diffWeeks });
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths === 1) return t("profile.joined.monthAgo");
      if (diffMonths < 12) return t("profile.joined.monthsAgo", { count: diffMonths });
      const diffYears = Math.floor(diffDays / 365);
      if (diffYears === 1) return t("profile.joined.yearAgo");
      return t("profile.joined.yearsAgo", { count: diffYears });
    }

    case "full":
      return t("profile.joined.on", { date: fullDate });

    case "short":
      return t("profile.joined.since", { date: `${month} ${year}` });

    case "date_only":
      return fullDate;

    case "year_only":
      return t("profile.joined.since", { date: String(year) });

    case "numeric":
      return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);

    default:
      return t("profile.joined.on", { date: fullDate });
  }
};
