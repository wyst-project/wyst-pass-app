import type { EncryptedItem, PassVaultInfo } from "@/lib/api/pass";

export const CACHE_VERSION = 1;

export interface VaultSnapshot {
  version: number;
  userId: number;
  vault: PassVaultInfo;
  items: EncryptedItem[];
  savedAt: string;
}

export interface CacheAdapter {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  limit: number;
}

const WEB_LIMIT = 4 * 1024 * 1024;

const webAdapter: CacheAdapter = {
  async read(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  async remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
  limit: WEB_LIMIT,
};

let adapter: CacheAdapter = webAdapter;

export const setCacheAdapter = (next: CacheAdapter) => {
  adapter = next;
};

const keyFor = (userId: number) => `wyst.pass.cache.${userId}`;

export async function readSnapshot(
  userId: number,
): Promise<VaultSnapshot | null> {
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const raw = await adapter.read(keyFor(userId));
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw) as VaultSnapshot;
    if (snapshot.version !== CACHE_VERSION || snapshot.userId !== userId)
      return null;
    if (!snapshot.vault?.salt || !Array.isArray(snapshot.items)) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export async function writeSnapshot(
  userId: number,
  vault: PassVaultInfo,
  items: EncryptedItem[],
): Promise<void> {
  if (!Number.isInteger(userId) || userId <= 0) return;
  const snapshot: VaultSnapshot = {
    version: CACHE_VERSION,
    userId,
    vault,
    items,
    savedAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(snapshot);
  if (raw.length > adapter.limit) {
    await adapter.remove(keyFor(userId));
    return;
  }
  await adapter.write(keyFor(userId), raw);
}

export const clearSnapshot = (userId: number) => adapter.remove(keyFor(userId));

export function isOfflineError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const status = (error as { status?: number })?.status;
  if (typeof status !== "number") return true;
  return status >= 500 || status === 0 || status === 408 || status === 429;
}