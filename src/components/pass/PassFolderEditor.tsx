"use client";

import { useState } from "react";
import { Check, FolderPlus, Loader2 } from "lucide-react";
import { emptyItem, type PassItemData } from "@/lib/pass/crypto";
import type { FolderOption } from "./PassEditor";
import { FOLDER_COLORS, FOLDER_ICONS, ItemAvatar, folderColor } from "./ServiceIcon";
import { ModalShell, fieldClass, primaryButton, secondaryButton } from "./PassUi";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
export function PassFolderEditor({
  folder,
  folderId,
  folders,
  defaultParentId = null,
  onClose,
  onSave,
}: {
  folder: PassItemData | null;
  folderId: string | null;
  folders: FolderOption[];
  defaultParentId?: string | null;
  onClose: () => void;
  onSave: (data: PassItemData) => Promise<void>;
}) {
  const t = useT();
  const editing = folder !== null;
  const [data, setData] = useState<PassItemData>(() => folder ?? { ...emptyItem("folder", defaultParentId), icon: "folder", color: FOLDER_COLORS[0] });
  const parents = folders.filter((option) => {
    if (!folderId) return true;
    if (option.id === folderId) return false;
    const chain = new Set<string>();
    let cursor: string | null = option.data.folderId;
    while (cursor && !chain.has(cursor)) {
      if (cursor === folderId) return false;
      chain.add(cursor);
      cursor = folders.find((entry) => entry.id === cursor)?.data.folderId ?? null;
    }
    return true;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const title = data.title.trim();
    if (!title) {
      setError(t("pass.folder.nameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ ...data, kind: "folder", title, color: folderColor(data.color) });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pass.editor.generic"));
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} icon={<FolderPlus className="size-5" />} title={t(editing ? "pass.folder.editTitle" : "pass.folder.createTitle")}>
      <form onSubmit={submit} className="mt-5 space-y-4">
        {error && <p className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-[13px] text-red-400">{error}</p>}

        <div className="flex items-center gap-3">
          <ItemAvatar data={data} className="size-12 text-base" />
          <div className="min-w-0 flex-1">
            <label className="block text-[13px] text-white/50">{t("pass.folder.name")}</label>
            <input
              type="text"
              value={data.title}
              onChange={(e) => setData((d) => ({ ...d, title: e.target.value.slice(0, 40) }))}
              placeholder={t("pass.folder.namePlaceholder")}
              autoFocus
              className={`${fieldClass} mt-1.5`}
            />
          </div>
        </div>

        <div>
          <label className="block text-[13px] text-white/50">{t("pass.folder.parent")}</label>
          <select
            value={data.folderId ?? ""}
            onChange={(e) => setData((d) => ({ ...d, folderId: e.target.value || null }))}
            className={cn(fieldClass, "mt-2 appearance-none bg-[#0c0c0c]")}
          >
            <option value="">{t("pass.folder.root")}</option>
            {parents.map((option) => (
              <option key={option.id} value={option.id}>
                {option.path}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-[13px] text-white/50">{t("pass.folder.icon")}</p>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {Object.entries(FOLDER_ICONS).map(([id, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setData((d) => ({ ...d, icon: id }))}
                aria-pressed={data.icon === id}
                className={cn(
                  "flex h-10 items-center justify-center rounded-md border transition-colors duration-200",
                  data.icon === id
                    ? "border-bio-primary/40 bg-bio-primary/[0.12] text-white"
                    : "border-white/[0.06] bg-white/[0.02] text-white/45 hover:bg-white/[0.05] hover:text-white/80"
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[13px] text-white/50">{t("pass.folder.color")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FOLDER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setData((d) => ({ ...d, color }))}
                aria-pressed={data.color === color}
                aria-label={color}
                className="flex size-8 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110"
                style={{ backgroundColor: color }}
              >
                {data.color === color && <Check className="size-4 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={`${secondaryButton} flex-1`}>
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={saving} className={`${primaryButton} flex-1`}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t(saving ? "pass.editor.saving" : editing ? "pass.editor.save" : "pass.editor.create")}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
