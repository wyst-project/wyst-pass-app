export const KDF = "pbkdf2-sha256";
export const KDF_ITERATIONS = 600000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface VaultMaterial {
  kdf: string;
  salt: string;
  iterations: number;
  wrappedKey: string;
  wrapIv: string;
}

export interface EncryptedPayload {
  iv: string;
  ciphertext: string;
}

export type PassItemKind = "login" | "note" | "card" | "folder";

export const ITEM_KINDS: PassItemKind[] = ["login", "note", "card", "folder"];

export interface PassItemData {
  kind: PassItemKind;
  title: string;
  username: string;
  password: string;
  urls: string[];
  totp: string;
  note: string;
  cardHolder: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  folderId: string | null;
  favorite: boolean;
  icon: string;
  color: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const randomBytes = (length: number) =>
  crypto.getRandomValues(new Uint8Array(length));

const buffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.slice().buffer as ArrayBuffer;

async function deriveWrappingKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
) {
  const base = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: buffer(salt), iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function wrapVaultKey(
  vaultKey: CryptoKey,
  password: string,
): Promise<VaultMaterial> {
  const salt = randomBytes(SALT_BYTES);
  const wrapIv = randomBytes(IV_BYTES);
  const wrappingKey = await deriveWrappingKey(password, salt, KDF_ITERATIONS);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", vaultKey));
  const wrapped = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: buffer(wrapIv) },
      wrappingKey,
      buffer(raw),
    ),
  );
  return {
    kdf: KDF,
    salt: toBase64(salt),
    iterations: KDF_ITERATIONS,
    wrappedKey: toBase64(wrapped),
    wrapIv: toBase64(wrapIv),
  };
}

export async function createVault(
  password: string,
): Promise<{ vaultKey: CryptoKey; material: VaultMaterial }> {
  const vaultKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  return { vaultKey, material: await wrapVaultKey(vaultKey, password) };
}

export async function unlockVault(
  password: string,
  material: VaultMaterial,
): Promise<CryptoKey | null> {
  try {
    const wrappingKey = await deriveWrappingKey(
      password,
      fromBase64(material.salt),
      material.iterations,
    );
    const raw = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: buffer(fromBase64(material.wrapIv)) },
      wrappingKey,
      buffer(fromBase64(material.wrappedKey)),
    );
    return crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }
}

export const rewrapVault = (vaultKey: CryptoKey, password: string) =>
  wrapVaultKey(vaultKey, password);

export async function encryptItem(
  vaultKey: CryptoKey,
  item: PassItemData,
): Promise<EncryptedPayload> {
  const iv = randomBytes(IV_BYTES);
  const plain = encoder.encode(JSON.stringify(item));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: buffer(iv) },
      vaultKey,
      buffer(plain),
    ),
  );
  return { iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}

const str = (value: unknown, max: number) =>
  typeof value === "string" ? value.slice(0, max) : "";

export async function decryptItem(
  vaultKey: CryptoKey,
  payload: EncryptedPayload,
): Promise<PassItemData | null> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: buffer(fromBase64(payload.iv)) },
      vaultKey,
      buffer(fromBase64(payload.ciphertext)),
    );
    return normalizeItem(JSON.parse(decoder.decode(plain)));
  } catch {
    return null;
  }
}

export function normalizeItem(value: unknown): PassItemData {
  const raw = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const kind = ITEM_KINDS.includes(raw.kind as PassItemKind)
    ? (raw.kind as PassItemKind)
    : "login";
  return {
    kind,
    title: str(raw.title, 100),
    username: str(raw.username, 200),
    password: str(raw.password, 500),
    urls: Array.isArray(raw.urls)
      ? raw.urls.filter((u): u is string => typeof u === "string").slice(0, 10)
      : [],
    totp: str(raw.totp, 500),
    note: str(raw.note, 5000),
    cardHolder: str(raw.cardHolder, 100),
    cardNumber: str(raw.cardNumber, 30),
    cardExpiry: str(raw.cardExpiry, 7),
    cardCvv: str(raw.cardCvv, 4),
    folderId:
      typeof raw.folderId === "string" && raw.folderId
        ? raw.folderId.slice(0, 64)
        : null,
    favorite: raw.favorite === true,
    icon: str(raw.icon, 24),
    color: /^#[0-9a-fA-F]{6}$/.test(String(raw.color ?? ""))
      ? String(raw.color)
      : "",
  };
}

export const EMPTY_ITEM: PassItemData = {
  kind: "login",
  title: "",
  username: "",
  password: "",
  urls: [],
  totp: "",
  note: "",
  cardHolder: "",
  cardNumber: "",
  cardExpiry: "",
  cardCvv: "",
  folderId: null,
  favorite: false,
  icon: "",
  color: "",
};

export const emptyItem = (
  kind: PassItemKind,
  folderId: string | null = null,
): PassItemData => ({ ...EMPTY_ITEM, kind, folderId });