"use client";

import {
  Bitcoin,
  Briefcase,
  Camera,
  CreditCard,
  Film,
  Folder,
  Gamepad2,
  Globe,
  GraduationCap,
  Heart,
  House,
  Landmark,
  Mail,
  Music,
  Plane,
  Server,
  Shield,
  ShoppingBag,
  Star,
  StickyNote,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import PlatformIcon from "@/components/PlatformIcon";
import type { PassItemData } from "@/lib/pass/crypto";
import { detectService, serviceTone, type Service } from "@/lib/pass/services";
import { cn } from "@/lib/utils";

export function ServiceIcon({
  service,
  className,
}: {
  service: Service;
  className?: string;
}) {
  if (service.platform)
    return <PlatformIcon platform={service.platform} className={className} />;
  if (service.id === "microsoft") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
        <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
        <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
        <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d={service.path ?? ""} />
    </svg>
  );
}

export const FOLDER_ICONS: Record<string, LucideIcon> = {
  folder: Folder,
  gamepad: Gamepad2,
  work: Briefcase,
  bank: Landmark,
  card: CreditCard,
  mail: Mail,
  shop: ShoppingBag,
  music: Music,
  film: Film,
  camera: Camera,
  server: Server,
  web: Globe,
  school: GraduationCap,
  heart: Heart,
  star: Star,
  home: House,
  plane: Plane,
  shield: Shield,
  users: Users,
  crypto: Bitcoin,
  zap: Zap,
};

export const FOLDER_COLORS = [
  "#bf3664",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#94a3b8",
];

export const folderColor = (color: string) =>
  /^#[0-9a-fA-F]{6}$/.test(color) ? color : FOLDER_COLORS[0];

const rgba = (hex: string, alpha: number) => {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
};

export function ItemAvatar({
  data,
  className,
}: {
  data: PassItemData;
  className?: string;
}) {
  const base = "flex shrink-0 items-center justify-center rounded-lg";
  const ring = "ring-1 ring-inset";

  if (data.kind === "folder") {
    const Icon = FOLDER_ICONS[data.icon] ?? Folder;
    const color = folderColor(data.color);
    return (
      <span
        className={cn(base, className)}
        style={{
          backgroundColor: rgba(color, 0.14),
          color,
          boxShadow: `inset 0 0 0 1px ${rgba(color, 0.3)}`,
        }}
      >
        <Icon className="size-[55%]" />
      </span>
    );
  }

  if (data.kind === "note") {
    return (
      <span
        className={cn(
          base,
          ring,
          "bg-amber-400/10 text-amber-300 ring-amber-400/25",
          className,
        )}
      >
        <StickyNote className="size-[50%]" />
      </span>
    );
  }

  if (data.kind === "card") {
    return (
      <span
        className={cn(
          base,
          ring,
          "bg-sky-400/10 text-sky-300 ring-sky-400/25",
          className,
        )}
      >
        <CreditCard className="size-[50%]" />
      </span>
    );
  }

  const service = detectService(data.urls);
  if (service) {
    const tone = serviceTone(service.hex);
    return (
      <span
        className={cn(base, ring, "ring-white/[0.08]", className)}
        style={{ backgroundColor: tone.background, color: tone.color }}
        title={service.name}
      >
        <ServiceIcon service={service} className="size-[55%]" />
      </span>
    );
  }

  const initials = data.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={cn(
        base,
        ring,
        "bg-bio-primary/10 font-semibold text-bio-primary ring-bio-primary/20",
        className,
      )}
    >
      {initials || "•"}
    </span>
  );
}
