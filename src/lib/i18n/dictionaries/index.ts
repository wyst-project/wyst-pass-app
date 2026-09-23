import { en, type Dictionary } from "./en";
import { fr } from "./fr";
import { pt } from "./pt";
import type { Locale } from "../locales";

export type { Dictionary };
export const dictionaries: Record<Locale, Dictionary> = { en, fr, pt };
