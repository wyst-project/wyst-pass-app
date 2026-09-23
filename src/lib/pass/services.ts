import { SERVICE_ICONS } from "./serviceIcons";

export interface Service {
  id: string;
  name: string;
  hex: string;
  domains: string[];
  path: string | null;
  platform: string | null;
}

const EXTRA: Service[] = [
  {
    id: "linkedin",
    name: "LinkedIn",
    hex: "0A66C2",
    domains: ["linkedin.com"],
    path: null,
    platform: "linkedin",
  },
  {
    id: "amazon",
    name: "Amazon",
    hex: "FF9900",
    domains: [
      "amazon.com",
      "amazon.fr",
      "amazon.de",
      "amazon.co.uk",
      "amazon.es",
      "amazon.it",
      "amazon.ca",
      "amazon.co.jp",
      "aws.amazon.com",
    ],
    path: null,
    platform: "amazon",
  },
  {
    id: "statsfm",
    name: "stats.fm",
    hex: "1ED760",
    domains: ["stats.fm"],
    path: null,
    platform: "statsfm",
  },
  {
    id: "microsoft",
    name: "Microsoft",
    hex: "5E5E5E",
    domains: [
      "microsoft.com",
      "live.com",
      "outlook.com",
      "hotmail.com",
      "office.com",
      "microsoftonline.com",
      "xbox.com",
      "minecraft.net",
      "mojang.com",
      "azure.com",
      "onedrive.com",
      "skype.com",
    ],
    path: null,
    platform: null,
  },
];

export const SERVICES: Service[] = [
  ...SERVICE_ICONS.map((icon) => ({
    id: icon.slug,
    name: icon.name,
    hex: icon.hex,
    domains: icon.domains,
    path: icon.path,
    platform: null,
  })),
  ...EXTRA,
];

const SERVICE_BY_ID = new Map(SERVICES.map((service) => [service.id, service]));

const DOMAIN_INDEX: { domain: string; service: Service }[] = SERVICES.flatMap(
  (service) => service.domains.map((domain) => ({ domain, service })),
).sort((a, b) => b.domain.length - a.domain.length);

export const getService = (id: string) => SERVICE_BY_ID.get(id) ?? null;

export function hostOf(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`,
    );
    return url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  } catch {
    return "";
  }
}

export function findServiceByHost(host: string): Service | null {
  if (!host) return null;
  for (const entry of DOMAIN_INDEX) {
    if (host === entry.domain || host.endsWith(`.${entry.domain}`))
      return entry.service;
  }
  return null;
}

export function detectService(urls: string[]): Service | null {
  for (const url of urls) {
    const service = findServiceByHost(hostOf(url));
    if (service) return service;
  }
  return null;
}

const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function searchServices(query: string, limit = 6): Service[] {
  const needle = fold(query.trim());
  if (needle.length < 2) return [];
  const scored: { service: Service; score: number }[] = [];
  for (const service of SERVICES) {
    const name = fold(service.name);
    const domains = service.domains.map(fold);
    let score = 0;
    if (name.startsWith(needle)) score = 3;
    else if (domains.some((domain) => domain.startsWith(needle))) score = 2;
    else if (
      name.includes(needle) ||
      domains.some((domain) => domain.includes(needle))
    )
      score = 1;
    if (score) scored.push({ service, score });
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score || a.service.name.localeCompare(b.service.name),
    )
    .slice(0, limit)
    .map((entry) => entry.service);
}

export const serviceUrl = (service: Service) => `https://${service.domains[0]}`;

export function serviceTone(hex: string): {
  color: string;
  background: string;
} {
  const value = parseInt(hex, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance < 0.22)
    return { color: "#ffffff", background: "rgba(255,255,255,0.08)" };
  return { color: `#${hex}`, background: `rgba(${r},${g},${b},0.14)` };
}