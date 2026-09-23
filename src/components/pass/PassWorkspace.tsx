"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CloudOff,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FolderPlus,
  KeyRound,
  Loader2,
  Lock,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  StickyNote,
  Trash2,
} from "lucide-react";
import { PassDetail, type DecryptedItem } from "@/components/pass/PassDetail";
import { PassEditor, type FolderOption } from "@/components/pass/PassEditor";
import { PassFolderEditor } from "@/components/pass/PassFolderEditor";
import { ItemAvatar } from "@/components/pass/ServiceIcon";
import {
  ModalShell,
  primaryButton,
  secondaryButton,
} from "@/components/pass/PassUi";
import {
  ChangeMasterModal,
  DeleteVaultModal,
  VaultSetup,
  VaultUnlock,
} from "@/components/pass/PassVaultForms";
import {
  createPassItem,
  deletePassItem,
  getPassVault,
  listPassItems,
  updatePassItem,
  type EncryptedItem,
  type PassVaultInfo,
} from "@/lib/api/pass";
import {
  decryptItem,
  encryptItem,
  type PassItemData,
  type PassItemKind,
} from "@/lib/pass/crypto";
import {
  clearSnapshot,
  isOfflineError,
  readSnapshot,
  writeSnapshot,
} from "@/lib/pass/cache";
import { detectService, hostOf } from "@/lib/pass/services";
import { cn } from "@/lib/utils";
import { rich, useI18n, useT } from "@/lib/i18n";

const AUTO_LOCK_MS = 10 * 60 * 1000;
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

type VaultState =
  | { loaded: true; vault: PassVaultInfo | null; error: string }
  | { loaded: false };
type Tab = "all" | "favorites" | "recent";
type EntryKind = Exclude<PassItemKind, "folder">;

interface FolderNode {
  folder: DecryptedItem;
  items: DecryptedItem[];
  children: FolderNode[];
  total: number;
}

const NEW_KINDS: {
  kind: EntryKind;
  icon: React.ComponentType<{ className?: string }>;
  label: "pass.list.newLogin" | "pass.list.newNote" | "pass.list.newCard";
}[] = [
  { kind: "login", icon: KeyRound, label: "pass.list.newLogin" },
  { kind: "note", icon: StickyNote, label: "pass.list.newNote" },
  { kind: "card", icon: CreditCard, label: "pass.list.newCard" },
];

export interface PassEventDetail {
  type:
    | "locked"
    | "autolocked"
    | "unlocked"
    | "vault-created"
    | "item-created"
    | "item-saved"
    | "item-deleted"
    | "folder-created"
    | "folder-saved"
    | "folder-deleted";
  kind?: PassItemKind;
  title?: string;
}

const emitPassEvent = (detail: PassEventDetail) =>
  window.dispatchEvent(
    new CustomEvent<PassEventDetail>("wyst-pass:event", { detail }),
  );

const readAccountId = (): number | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    const id = raw ? (JSON.parse(raw) as { id?: unknown }).id : null;
    return typeof id === "number" && Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
};

const updatedTime = (item: DecryptedItem) =>
  new Date(item.updatedAt ?? 0).getTime();
const byPinThenDate = (a: DecryptedItem, b: DecryptedItem) =>
  Number(b.data.favorite) - Number(a.data.favorite) ||
  updatedTime(b) - updatedTime(a);

export interface WorkspaceUnlockProps {
  vault: PassVaultInfo;
  onUnlocked: (key: CryptoKey) => void;
  onDelete: () => void;
}

export interface WorkspaceSetupProps {
  onCreated: (vault: PassVaultInfo, key: CryptoKey) => void;
}

export function PassWorkspace({
  banner,
  accessory,
  panelHeight = "lg:h-[calc(100vh-13.5rem)]",
  variant = "web",
  userId,
  renderSetup,
  renderUnlock,
  onLockedChange,
}: {
  banner?: React.ReactNode;
  accessory?: React.ReactNode;
  panelHeight?: string;
  variant?: "web" | "app";
  userId?: number | null;
  renderSetup?: (props: WorkspaceSetupProps) => React.ReactNode;
  renderUnlock?: (props: WorkspaceUnlockProps) => React.ReactNode;
  onLockedChange?: (locked: boolean) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const isApp = variant === "app";
  const [vaultState, setVaultState] = useState<VaultState>({ loaded: false });
  const [offline, setOffline] = useState(false);
  const [reload, setReload] = useState(0);
  const account = userId ?? readAccountId();
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [items, setItems] = useState<DecryptedItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    item: DecryptedItem | null;
    kind: EntryKind;
    folderId: string | null;
  } | null>(null);
  const [folderEditor, setFolderEditor] = useState<{
    folder: DecryptedItem | null;
    parentId: string | null;
  } | null>(null);
  const [removing, setRemoving] = useState<DecryptedItem | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, setToast] = useState("");
  const lastActivity = useRef(0);
  const [clock, setClock] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    getPassVault()
      .then((vault) => {
        if (cancelled) return;
        setOffline(false);
        setVaultState({ loaded: true, vault, error: "" });
      })
      .catch(async (err) => {
        const snapshot =
          isOfflineError(err) && account ? await readSnapshot(account) : null;
        if (cancelled) return;
        if (snapshot) {
          setOffline(true);
          setVaultState({ loaded: true, vault: snapshot.vault, error: "" });
          return;
        }
        setVaultState({
          loaded: true,
          vault: null,
          error: err instanceof Error ? err.message : "",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [account, reload]);

  useEffect(() => {
    if (!offline) return;
    const retry = () => setReload((n) => n + 1);
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
    };
  }, [offline]);

  const lock = useCallback(() => {
    setVaultKey(null);
    setItems(null);
    setSelectedId(null);
    setEditor(null);
    setFolderEditor(null);
    setRemoving(null);
  }, []);

  useEffect(() => {
    onLockedChange?.(!vaultKey);
  }, [vaultKey]);

  useEffect(() => {
    const onLock = () => {
      lock();
      emitPassEvent({ type: "locked" });
    };
    window.addEventListener("wyst-pass:lock", onLock);
    return () => window.removeEventListener("wyst-pass:lock", onLock);
  }, [lock]);

  useEffect(() => {
    if (!vaultKey) return;
    let cancelled = false;
    const decryptAll = async (encrypted: EncryptedItem[]) => {
      const decrypted: DecryptedItem[] = [];
      for (const entry of encrypted) {
        const data = await decryptItem(vaultKey, entry);
        if (data)
          decrypted.push({
            id: entry.id,
            data,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          });
      }
      return decrypted;
    };
    listPassItems()
      .then(async (encrypted) => {
        const decrypted = await decryptAll(encrypted);
        if (cancelled) return;
        setOffline(false);
        setClock(Date.now());
        setItems(decrypted);
        const vault = vaultState.loaded ? vaultState.vault : null;
        if (account && vault) void writeSnapshot(account, vault, encrypted);
      })
      .catch(async (err) => {
        const snapshot =
          isOfflineError(err) && account ? await readSnapshot(account) : null;
        const decrypted = snapshot ? await decryptAll(snapshot.items) : [];
        if (cancelled) return;
        if (snapshot) setOffline(true);
        setClock(Date.now());
        setItems(decrypted);
      });
    return () => {
      cancelled = true;
    };
  }, [vaultKey, reload]);

  useEffect(() => {
    if (!vaultKey) return;
    lastActivity.current = Date.now();
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "click",
      "touchstart",
      "scroll",
    ];
    for (const event of events)
      window.addEventListener(event, touch, { passive: true });
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current > AUTO_LOCK_MS) {
        lock();
        setToast(t("pass.toast.locked"));
        emitPassEvent({ type: "autolocked" });
      }
    }, 5000);
    return () => {
      for (const event of events) window.removeEventListener(event, touch);
      clearInterval(timer);
    };
  }, [vaultKey, lock, t]);

  const folders = useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.data.kind === "folder")
        .sort((a, b) => a.data.title.localeCompare(b.data.title)),
    [items],
  );
  const folderIds = useMemo(
    () => new Set(folders.map((folder) => folder.id)),
    [folders],
  );
  const entries = useMemo(
    () => (items ?? []).filter((item) => item.data.kind !== "folder"),
    [items],
  );
  const folderOf = useCallback(
    (item: DecryptedItem) =>
      item.data.folderId &&
      item.data.folderId !== item.id &&
      folderIds.has(item.data.folderId)
        ? item.data.folderId
        : null,
    [folderIds],
  );
  const folderPath = useCallback(
    (id: string | null) => {
      const names: string[] = [];
      const seen = new Set<string>();
      let cursor = id;
      while (cursor && !seen.has(cursor) && names.length < 10) {
        seen.add(cursor);
        const folder = folders.find((entry) => entry.id === cursor);
        if (!folder) break;
        names.unshift(folder.data.title);
        cursor = folderOf(folder);
      }
      return names.join(" / ");
    },
    [folders, folderOf],
  );
  const folderOptions: FolderOption[] = useMemo(
    () =>
      folders
        .map((folder) => ({
          id: folder.id,
          data: folder.data,
          path: folderPath(folder.id),
        }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    [folders, folderPath],
  );

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const now = clock;
    return entries
      .filter((item) => {
        if (
          tab === "recent" &&
          (!item.updatedAt || now - updatedTime(item) > RECENT_MS)
        )
          return false;
        if (tab === "favorites" && !item.data.favorite) return false;
        if (!needle) return true;
        const service = detectService(item.data.urls);
        const haystack = [
          item.data.title,
          item.data.username,
          item.data.cardHolder,
          ...item.data.urls,
          item.data.note,
          service?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort(byPinThenDate);
  }, [entries, needle, tab, clock]);

  const tree = useMemo(() => {
    const byFolder = new Map<string, DecryptedItem[]>();
    const loose: DecryptedItem[] = [];
    for (const item of filtered) {
      const folderId = folderOf(item);
      if (!folderId) loose.push(item);
      else byFolder.set(folderId, [...(byFolder.get(folderId) ?? []), item]);
    }
    const childrenOf = new Map<string | null, DecryptedItem[]>();
    for (const folder of folders) {
      const parent = folderOf(folder);
      childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), folder]);
    }
    const seen = new Set<string>();
    const build = (folder: DecryptedItem): FolderNode => {
      seen.add(folder.id);
      const own = byFolder.get(folder.id) ?? [];
      const children = (childrenOf.get(folder.id) ?? [])
        .filter((child) => !seen.has(child.id))
        .map(build);
      return {
        folder,
        items: own,
        children,
        total:
          own.length + children.reduce((sum, child) => sum + child.total, 0),
      };
    };
    const roots = (childrenOf.get(null) ?? []).map(build);
    for (const folder of folders)
      if (!seen.has(folder.id)) roots.push(build(folder));
    return { roots, loose };
  }, [filtered, folders, folderOf]);

  const groups = useMemo(() => {
    const now = clock;
    const buckets: {
      key: "today" | "week" | "older";
      items: DecryptedItem[];
    }[] = [
      { key: "today", items: [] },
      { key: "week", items: [] },
      { key: "older", items: [] },
    ];
    for (const item of filtered) {
      const age = now - updatedTime(item);
      const bucket = age < 24 * 60 * 60 * 1000 ? 0 : age < RECENT_MS ? 1 : 2;
      buckets[bucket].items.push(item);
    }
    return buckets.filter((bucket) => bucket.items.length > 0);
  }, [filtered, clock]);

  const treeView = tab === "all" && !needle;
  const selected = entries.find((item) => item.id === selectedId) ?? null;
  const selectedFolder = selected
    ? (folders.find((folder) => folder.id === folderOf(selected)) ?? null)
    : null;
  const favoritesCount = entries.filter((item) => item.data.favorite).length;

  const persist = async (
    existing: DecryptedItem | null,
    data: PassItemData,
  ): Promise<DecryptedItem> => {
    if (!vaultKey) throw new Error(t("pass.editor.generic"));
    const payload = await encryptItem(vaultKey, data);
    setClock(Date.now());
    if (existing) {
      const saved = await updatePassItem(existing.id, payload);
      const next = {
        id: saved.id,
        data,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      };
      setItems((current) =>
        current
          ? current.map((item) => (item.id === saved.id ? next : item))
          : current,
      );
      return next;
    }
    const saved = await createPassItem(payload);
    const next = {
      id: saved.id,
      data,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
    setItems((current) => [next, ...(current ?? [])]);
    return next;
  };

  const saveItem = async (data: PassItemData) => {
    if (!editor) return;
    const saved = await persist(editor.item, data);
    if (!editor.item) setSelectedId(saved.id);
    if (data.folderId) {
      const folderId = data.folderId;
      setCollapsed((current) => {
        const next = new Set(current);
        next.delete(folderId);
        return next;
      });
    }
    setToast(t(editor.item ? "pass.toast.saved" : "pass.toast.created"));
    emitPassEvent({
      type: editor.item ? "item-saved" : "item-created",
      kind: data.kind,
      title: data.title,
    });
    setEditor(null);
  };

  const saveFolder = async (data: PassItemData) => {
    if (!folderEditor) return;
    await persist(folderEditor.folder, data);
    setToast(
      t(
        folderEditor.folder
          ? "pass.toast.folderSaved"
          : "pass.toast.folderCreated",
      ),
    );
    emitPassEvent({
      type: folderEditor.folder ? "folder-saved" : "folder-created",
      kind: "folder",
      title: data.title,
    });
    setFolderEditor(null);
  };

  const toggleFavorite = async (item: DecryptedItem) => {
    await persist(item, { ...item.data, favorite: !item.data.favorite });
  };

  const removeItem = async (item: DecryptedItem) => {
    await deletePassItem(item.id);
    const isFolder = item.data.kind === "folder";
    setItems((current) =>
      current
        ? current
            .filter((entry) => entry.id !== item.id)
            .map((entry) =>
              isFolder && entry.data.folderId === item.id
                ? { ...entry, data: { ...entry.data, folderId: null } }
                : entry,
            )
        : current,
    );
    if (selectedId === item.id) setSelectedId(null);
    setRemoving(null);
    setToast(t(isFolder ? "pass.toast.folderDeleted" : "pass.toast.deleted"));
    emitPassEvent({
      type: isFolder ? "folder-deleted" : "item-deleted",
      kind: item.data.kind,
      title: item.data.title,
    });
  };

  const toggleCollapsed = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openNew = (kind: EntryKind, folderId: string | null = null) =>
    setEditor({ item: null, kind, folderId });

  const count =
    items === null && vaultState.loaded && vaultState.vault
      ? vaultState.vault.items
      : entries.length;

  const renderRow = (item: DecryptedItem) => (
    <ItemRow
      key={item.id}
      item={item}
      active={selectedId === item.id}
      onClick={() => setSelectedId(item.id)}
    />
  );

  const renderFolder = (node: FolderNode) => {
    const { folder } = node;
    const open = !collapsed.has(folder.id);
    return (
      <div key={folder.id}>
        <div className="group flex items-center gap-1 rounded-lg pr-1 transition-colors duration-200 hover:bg-white/[0.04]">
          <button
            type="button"
            onClick={() => toggleCollapsed(folder.id)}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left"
          >
            <ChevronRight
              className={cn(
                "size-3.5 shrink-0 text-white/30 transition-transform duration-200",
                open && "rotate-90",
              )}
            />
            <ItemAvatar data={folder.data} className="size-7" />
            <span className="truncate text-[13px] font-medium text-white/85">
              {folder.data.title}
            </span>
            <span className="text-[11px] text-white/30">{node.total}</span>
          </button>
          <span
            className={cn(
              "flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100",
              offline && "hidden",
            )}
          >
            <NewMenu
              compact
              onPick={(kind) => openNew(kind, folder.id)}
              onFolder={() =>
                setFolderEditor({ folder: null, parentId: folder.id })
              }
            />
            <FolderAction
              icon={Pencil}
              label={t("pass.folder.rename")}
              onClick={() => setFolderEditor({ folder, parentId: null })}
            />
            <FolderAction
              icon={Trash2}
              label={t("pass.folder.delete")}
              onClick={() => setRemoving(folder)}
              danger
            />
          </span>
        </div>
        {open && (
          <div className="ml-[18px] mt-0.5 space-y-0.5 border-l border-white/[0.07] pl-2">
            {node.children.map((child) => renderFolder(child))}
            {node.items.map(renderRow)}
            {node.children.length === 0 && node.items.length === 0 && (
              <p className="px-2.5 py-2 text-[12px] text-white/25">
                {t("pass.list.folderEmpty")}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        isApp ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-5 sm:space-y-6",
      )}
    >
      {(!isApp || vaultKey) && (
        <header className="flex shrink-0 flex-col gap-4 rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-white/[0.01] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-bio-primary/10 text-bio-primary ring-1 ring-inset ring-bio-primary/20">
              <Lock className="size-[22px]" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight text-white sm:text-xl">
                {t("pass.title")}
              </h1>
              <p className="mt-1 text-[13px] leading-snug text-white/40">
                {t("pass.subtitle")}
              </p>
            </div>
          </div>
          {vaultState.loaded && vaultState.vault && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[12px] font-medium",
                  vaultKey
                    ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
                    : "border-white/[0.08] bg-white/[0.03] text-white/50",
                )}
              >
                {vaultKey ? (
                  <ShieldCheck className="size-4" />
                ) : (
                  <LockKeyhole className="size-4" />
                )}
                {t(vaultKey ? "pass.unlocked" : "pass.locked")}
                <span className="text-white/30">
                  ·{" "}
                  {t("pass.items", {
                    count: new Intl.NumberFormat(locale).format(count),
                  })}
                </span>
              </span>
              {vaultKey && !offline && (
                <>
                  <NewMenu
                    onPick={(kind) => openNew(kind)}
                    onFolder={() =>
                      setFolderEditor({ folder: null, parentId: null })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => {
                      lock();
                      setToast(t("pass.toast.locked"));
                      emitPassEvent({ type: "locked" });
                    }}
                    title={t("pass.lock")}
                    aria-label={t("pass.lock")}
                    className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/60 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
                  >
                    <LockKeyhole className="size-4" />
                  </button>
                  <VaultMenu
                    onChange={() => setChangeOpen(true)}
                    onDelete={() => setDeleteOpen(true)}
                  />
                </>
              )}
              {vaultKey && offline && (
                <button
                  type="button"
                  onClick={() => {
                    lock();
                    setToast(t("pass.toast.locked"));
                    emitPassEvent({ type: "locked" });
                  }}
                  title={t("pass.lock")}
                  aria-label={t("pass.lock")}
                  className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/60 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
                >
                  <LockKeyhole className="size-4" />
                </button>
              )}
              {accessory}
            </div>
          )}
        </header>
      )}

      {banner}

      {offline && vaultState.loaded && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3">
          <CloudOff className="size-4 shrink-0 text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-amber-100">
              {t("pass.offline.title")}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-amber-100/60">
              {t("pass.offline.body")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReload((n) => n + 1)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 text-[12.5px] font-medium text-amber-100 transition-colors duration-200 hover:bg-amber-400/20"
          >
            <RefreshCw className="size-3.5" />
            {t("pass.offline.retry")}
          </button>
        </div>
      )}

      {!vaultState.loaded ? (
        <div className="flex justify-center py-16 text-white/40">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : vaultState.error ? (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-[13px] text-red-400">
          {vaultState.error}
        </p>
      ) : !vaultState.vault ? (
        renderSetup ? (
          renderSetup({
            onCreated: (vault, key) => {
              setVaultState({ loaded: true, vault, error: "" });
              setVaultKey(key);
              emitPassEvent({ type: "vault-created" });
            },
          })
        ) : (
          <VaultSetup
            onCreated={(vault, key) => {
              setVaultState({ loaded: true, vault, error: "" });
              setVaultKey(key);
              emitPassEvent({ type: "vault-created" });
            }}
          />
        )
      ) : !vaultKey ? (
        renderUnlock ? (
          renderUnlock({
            vault: vaultState.vault,
            onUnlocked: (key) => {
              setVaultKey(key);
              emitPassEvent({ type: "unlocked" });
            },
            onDelete: () => setDeleteOpen(true),
          })
        ) : (
          <VaultUnlock
            vault={vaultState.vault}
            onUnlocked={setVaultKey}
            onDelete={() => setDeleteOpen(true)}
            panelHeight={panelHeight.replace("lg:h-", "lg:min-h-")}
          />
        )
      ) : (
        <div
          className={cn(
            "grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start",
            isApp && "min-h-0 flex-1 lg:items-stretch",
          )}
        >
          <section
            className={cn(
              "flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02]",
              panelHeight,
              selected && "hidden lg:flex",
            )}
          >
            <div className="space-y-3 border-b border-white/[0.06] p-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value.slice(0, 80))}
                  placeholder={t("pass.list.search")}
                  className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 text-sm text-white transition-colors duration-200 placeholder:text-white/25 focus:border-bio-primary/50 focus:outline-none"
                />
              </label>
              <div className="grid grid-cols-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
                {(["all", "favorites", "recent"] as const).map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setTab(entry)}
                    aria-pressed={tab === entry}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors duration-200",
                      tab === entry
                        ? "bg-white/[0.07] text-white"
                        : "text-white/45 hover:text-white/75",
                    )}
                  >
                    {entry === "favorites" && <Star className="size-3.5" />}
                    {t(`pass.list.${entry}`)}
                    {entry === "all" && items && (
                      <span className="text-white/30">{entries.length}</span>
                    )}
                    {entry === "favorites" && favoritesCount > 0 && (
                      <span className="text-white/30">{favoritesCount}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {items === null ? (
                <div className="flex justify-center py-12 text-white/40">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center px-4 py-12 text-center">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-white/[0.04] text-white/30">
                    <KeyRound className="size-5" />
                  </span>
                  <p className="mt-3 text-[14px] font-medium text-white/70">
                    {t("pass.list.empty")}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/35">
                    {t("pass.list.emptyHint")}
                  </p>
                  <button
                    type="button"
                    onClick={() => openNew("login")}
                    className={`${primaryButton} mt-5 h-9`}
                  >
                    <Plus className="size-4" />
                    {t("pass.list.newLogin")}
                  </button>
                </div>
              ) : treeView ? (
                <div>
                  <div className="flex items-center justify-between px-2.5 pb-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-white/30">
                      {t("pass.list.folders")}
                    </p>
                    {!offline && (
                      <FolderAction
                        icon={FolderPlus}
                        label={t("pass.list.newFolder")}
                        onClick={() =>
                          setFolderEditor({ folder: null, parentId: null })
                        }
                      />
                    )}
                  </div>
                  {tree.roots.length === 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setFolderEditor({ folder: null, parentId: null })
                      }
                      className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-white/[0.1] px-3 py-2.5 text-left text-[12.5px] text-white/40 transition-colors duration-200 hover:border-bio-primary/40 hover:bg-bio-primary/[0.06] hover:text-white"
                    >
                      <FolderPlus className="size-4 shrink-0" />
                      {t("pass.list.createFolder")}
                    </button>
                  ) : (
                    <div className="space-y-0.5">
                      {tree.roots.map((node) => renderFolder(node))}
                    </div>
                  )}
                  <p className="px-2.5 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-white/30">
                    {t(
                      folders.length > 0
                        ? "pass.list.noFolder"
                        : "pass.list.items",
                    )}
                  </p>
                  {tree.loose.length > 0 ? (
                    <div className="space-y-0.5">
                      {tree.loose.map(renderRow)}
                    </div>
                  ) : (
                    <p className="px-2.5 py-2 text-[12px] text-white/25">
                      {t(
                        folders.length > 0
                          ? "pass.list.allSorted"
                          : "pass.list.noMatch",
                      )}
                    </p>
                  )}
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-4 py-12 text-center text-[13px] text-white/35">
                  {t("pass.list.noMatch")}
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.key} className="mb-2">
                    <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-white/30">
                      {t(`pass.list.${group.key}`)}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map(renderRow)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section
            className={cn(
              "flex min-h-[420px] flex-col rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-white/[0.01]",
              panelHeight,
              !selected && "hidden lg:flex",
            )}
          >
            {selected ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="inline-flex items-center gap-1.5 px-5 pt-4 text-[12px] font-medium text-white/50 transition-colors duration-200 hover:text-white lg:hidden"
                >
                  <ArrowLeft className="size-3.5" />
                  {t("pass.list.all")}
                </button>
                <PassDetail
                  key={selected.id}
                  item={selected}
                  readOnly={offline}
                  folder={selectedFolder}
                  onEdit={() =>
                    setEditor({
                      item: selected,
                      kind: selected.data.kind as EntryKind,
                      folderId: null,
                    })
                  }
                  onDelete={() => setRemoving(selected)}
                  onToggleFavorite={() => void toggleFavorite(selected)}
                />
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                <span className="flex size-12 items-center justify-center rounded-xl bg-white/[0.04] text-white/30">
                  <Lock className="size-5" />
                </span>
                <p className="mt-3 text-[14px] font-medium text-white/70">
                  {t("pass.detail.pick")}
                </p>
                <p className="mt-1 text-[12px] text-white/35">
                  {t("pass.detail.pickHint")}
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {editor && vaultKey && (
        <PassEditor
          item={editor.item?.data ?? null}
          kind={editor.kind}
          folders={folderOptions}
          defaultFolderId={editor.folderId}
          onClose={() => setEditor(null)}
          onSave={saveItem}
        />
      )}
      {folderEditor && vaultKey && (
        <PassFolderEditor
          folder={folderEditor.folder?.data ?? null}
          folderId={folderEditor.folder?.id ?? null}
          folders={folderOptions}
          defaultParentId={folderEditor.parentId}
          onClose={() => setFolderEditor(null)}
          onSave={saveFolder}
        />
      )}
      {removing && (
        <RemoveItemModal
          item={removing}
          onClose={() => setRemoving(null)}
          onConfirm={() => removeItem(removing)}
        />
      )}
      {changeOpen && vaultState.loaded && vaultState.vault && (
        <ChangeMasterModal
          vault={vaultState.vault}
          onClose={() => setChangeOpen(false)}
          onChanged={(vault, key) => {
            setVaultState({ loaded: true, vault, error: "" });
            setVaultKey(key);
            setChangeOpen(false);
            setToast(t("pass.settings.changed"));
          }}
        />
      )}
      {deleteOpen && (
        <DeleteVaultModal
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            lock();
            if (account) void clearSnapshot(account);
            setVaultState({ loaded: true, vault: null, error: "" });
            setToast(t("pass.settings.deleted"));
          }}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-[#0c0c0c] px-4 py-2.5 text-[13px] font-medium text-white shadow-2xl">
            <Check className="size-4 text-emerald-400" />
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  active,
  onClick,
}: {
  item: DecryptedItem;
  active: boolean;
  onClick: () => void;
}) {
  const { data } = item;
  const subtitle =
    data.kind === "login"
      ? data.username || hostOf(data.urls[0] ?? "") || ""
      : data.kind === "card"
        ? data.cardNumber
          ? `•••• ${data.cardNumber.replace(/\D/g, "").slice(-4)}`
          : data.cardHolder
        : (data.note.split("\n")[0] ?? "");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-200",
        active
          ? "bg-bio-primary/[0.12] ring-1 ring-inset ring-bio-primary/25"
          : "hover:bg-white/[0.04]",
      )}
    >
      <ItemAvatar data={data} className="size-9 text-sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-white">
          {data.title}
        </span>
        <span className="block truncate text-[12px] text-white/40">
          {subtitle || "…"}
        </span>
      </span>
      {data.favorite && (
        <Star className="size-3.5 shrink-0 fill-current text-amber-300" />
      )}
    </button>
  );
}

function FolderAction({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-white/35 transition-colors duration-200",
        danger
          ? "hover:bg-red-500/10 hover:text-red-400"
          : "hover:bg-white/[0.06] hover:text-white",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function NewMenu({
  onPick,
  onFolder,
  compact = false,
}: {
  onPick: (kind: EntryKind) => void;
  onFolder: () => void;
  compact?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const entry =
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-white/70 transition-colors duration-200 hover:bg-white/[0.05] hover:text-white";
  return (
    <div className="relative">
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          title={t("pass.list.newMenu")}
          aria-label={t("pass.list.newMenu")}
          className="flex size-7 items-center justify-center rounded-md text-white/35 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
        >
          <Plus className="size-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-bio-primary px-3 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-bio-primary/90"
        >
          <Plus className="size-4" />
          {t("pass.list.newMenu")}
          <ChevronDown className="size-3.5 opacity-70" />
        </button>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1.5 w-56 overflow-hidden rounded-lg border border-white/[0.1] bg-[#0c0c0c] p-1 shadow-2xl"
          >
            {NEW_KINDS.map(({ kind, icon: Icon, label }) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onPick(kind);
                }}
                className={entry}
              >
                <Icon className="size-4 text-white/40" />
                {t(label)}
              </button>
            ))}
            <div className="my-1 border-t border-white/[0.06]" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onFolder();
              }}
              className={entry}
            >
              <FolderPlus className="size-4 text-white/40" />
              {t(compact ? "pass.list.newSubfolder" : "pass.list.newFolder")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function VaultMenu({
  onChange,
  onDelete,
}: {
  onChange: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("pass.settings.title")}
        aria-label={t("pass.settings.title")}
        className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/60 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
      >
        <Settings2 className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1.5 w-60 overflow-hidden rounded-lg border border-white/[0.1] bg-[#0c0c0c] p-1 shadow-2xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onChange();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-white/70 transition-colors duration-200 hover:bg-white/[0.05] hover:text-white"
            >
              <KeyRound className="size-4 text-white/40" />
              {t("pass.settings.change")}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-red-400 transition-colors duration-200 hover:bg-red-500/10"
            >
              <Trash2 className="size-4" />
              {t("pass.settings.delete")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function RemoveItemModal({
  item,
  onClose,
  onConfirm,
}: {
  item: DecryptedItem;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const isFolder = item.data.kind === "folder";
  return (
    <ModalShell
      onClose={onClose}
      icon={<Trash2 className="size-5" />}
      title={t(isFolder ? "pass.folder.delete" : "pass.remove.title")}
    >
      <p className="mt-2 text-[13px] leading-relaxed text-white/55">
        {rich(t(isFolder ? "pass.folder.deleteBody" : "pass.remove.body"), {
          title: (
            <span className="font-semibold text-white">{item.data.title}</span>
          ),
        })}
      </p>
      {error && (
        <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-[13px] text-red-400">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className={`${secondaryButton} flex-1`}
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={async () => {
            setDeleting(true);
            setError("");
            try {
              await onConfirm();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : t("pass.editor.generic"),
              );
              setDeleting(false);
            }
          }}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-red-500 text-[13px] font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {deleting && <Loader2 className="size-4 animate-spin" />}
          {t(deleting ? "pass.remove.deleting" : "pass.remove.confirm")}
        </button>
      </div>
    </ModalShell>
  );
}