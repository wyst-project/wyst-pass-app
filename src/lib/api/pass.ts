import { API_URL, getAuthHeaders } from "./config";
import type { EncryptedPayload, VaultMaterial } from "@/lib/pass/crypto";

export interface PassVaultInfo extends VaultMaterial {
  exists: true;
  items: number;
  lastItemAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EncryptedItem extends EncryptedPayload {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export class PassApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PassApiError";
    this.status = status;
  }
}

async function readError(response: Response): Promise<PassApiError> {
  let message = "Something went wrong";
  try {
    const body = await response.json();
    if (typeof body?.message === "string") message = body.message;
  } catch {}
  return new PassApiError(message, response.status);
}

const str = (value: unknown, max = 500): string | null =>
  typeof value === "string" && value.length > 0 ? value.slice(0, max) : null;

const parseVault = (raw: unknown): PassVaultInfo | null => {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (v.exists !== true) return null;
  const salt = str(v.salt, 64);
  const wrappedKey = str(v.wrappedKey, 128);
  const wrapIv = str(v.wrapIv, 32);
  const iterations = Number(v.iterations);
  if (!salt || !wrappedKey || !wrapIv || !Number.isInteger(iterations))
    return null;
  return {
    exists: true,
    kdf: str(v.kdf, 24) ?? "pbkdf2-sha256",
    salt,
    iterations,
    wrappedKey,
    wrapIv,
    items: Number.isFinite(Number(v.items)) ? Number(v.items) : 0,
    lastItemAt: str(v.lastItemAt, 40),
    createdAt: str(v.createdAt, 40),
    updatedAt: str(v.updatedAt, 40),
  };
};

const parseItem = (raw: unknown): EncryptedItem | null => {
  if (!raw || typeof raw !== "object") return null;
  const i = raw as Record<string, unknown>;
  const id = str(i.id, 36);
  const iv = str(i.iv, 32);
  const ciphertext = str(i.ciphertext, 32000);
  if (!id || !iv || !ciphertext) return null;
  return {
    id,
    iv,
    ciphertext,
    createdAt: str(i.createdAt, 40),
    updatedAt: str(i.updatedAt, 40),
  };
};

const request = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${API_URL}/api/pass${path}`, {
    ...init,
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw await readError(response);
  return response.json();
};

export async function getPassVault(): Promise<PassVaultInfo | null> {
  const body = await request("/vault");
  return parseVault(body?.data?.vault);
}

export async function createPassVault(
  material: VaultMaterial,
): Promise<PassVaultInfo> {
  const body = await request("/vault", {
    method: "POST",
    body: JSON.stringify(material),
  });
  const vault = parseVault(body?.data?.vault);
  if (!vault) throw new PassApiError("Invalid vault", 500);
  return vault;
}

export async function rewrapPassVault(
  material: VaultMaterial,
): Promise<PassVaultInfo> {
  const body = await request("/vault/key", {
    method: "PUT",
    body: JSON.stringify(material),
  });
  const vault = parseVault(body?.data?.vault);
  if (!vault) throw new PassApiError("Invalid vault", 500);
  return vault;
}

export async function deletePassVault(password: string): Promise<void> {
  await request("/vault", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
}

export async function listPassItems(): Promise<EncryptedItem[]> {
  const body = await request("/items");
  return Array.isArray(body?.data?.items)
    ? body.data.items
        .map(parseItem)
        .filter((i: EncryptedItem | null): i is EncryptedItem => i !== null)
    : [];
}

export async function createPassItem(
  payload: EncryptedPayload,
): Promise<EncryptedItem> {
  const body = await request("/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const item = parseItem(body?.data?.item);
  if (!item) throw new PassApiError("Invalid item", 500);
  return item;
}

export async function updatePassItem(
  id: string,
  payload: EncryptedPayload,
): Promise<EncryptedItem> {
  const body = await request(`/items/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  const item = parseItem(body?.data?.item);
  if (!item) throw new PassApiError("Invalid item", 500);
  return item;
}

export async function deletePassItem(id: string): Promise<void> {
  await request(`/items/${encodeURIComponent(id)}`, { method: "DELETE" });
}