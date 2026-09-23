"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { dictionaries, type Dictionary } from "./dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./locales";

type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;
type Vars = Record<string, string | number>;

const lookup = (dict: Dictionary, key: string): string | undefined =>
  key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object") return (node as Record<string, unknown>)[part];
    return undefined;
  }, dict) as string | undefined;

const interpolate = (template: string, vars?: Vars) =>
  vars
    ? template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match
      )
    : template;

export const translate = (locale: Locale, key: TranslationKey, vars?: Vars): string =>
  interpolate(lookup(dictionaries[locale], key) ?? lookup(dictionaries[DEFAULT_LOCALE], key) ?? key, vars);

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Vars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Vars) => {
      const value =
        lookup(dictionaries[locale], key) ??
        lookup(dictionaries[DEFAULT_LOCALE], key) ??
        key;
      return interpolate(value, vars);
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n doit etre utilise sous <I18nProvider>");
  return ctx;
}

export const useT = () => useI18n().t;
export const useDict = (): Dictionary => dictionaries[useI18n().locale];
