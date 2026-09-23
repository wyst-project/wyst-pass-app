import { API_URL, getAuthHeaders } from "@/lib/api/config";
import { clearSnapshot } from "@/lib/pass/cache";

export interface DesktopUser {
  id: number;
  username: string;
  email?: string;
  avatar?: string | null;
  discordAvatar?: string | null;
  premium?: boolean;
  passUnlocked?: boolean;
}

export interface Session {
  token: string;
  sessionId: number | null;
  user: DesktopUser;
}

export type LoginStep =
  | { type: "done"; session: Session }
  | { type: "twoFactor"; userId: number; challenge: string }
  | { type: "code"; userId: number; email: string };

export class SessionError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SessionError";
    this.status = status;
  }
}

const TOKEN_KEY = "sessionToken";
const USER_KEY = "user";
const SESSION_ID_KEY = "sessionId";

async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Wyst-Client": "desktop",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try {
    json = await response.json();
  } catch {}
  if (!response.ok)
    throw new SessionError(
      typeof json.message === "string" ? json.message : "Something went wrong",
      response.status,
    );
  return json;
}

const asUser = (raw: unknown): DesktopUser | null => {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  if (typeof u.id !== "number" || typeof u.username !== "string") return null;
  return {
    id: u.id,
    username: u.username,
    email: typeof u.email === "string" ? u.email : undefined,
    avatar: typeof u.avatar === "string" ? u.avatar : null,
    discordAvatar: typeof u.discordAvatar === "string" ? u.discordAvatar : null,
    premium: u.premium === true,
    passUnlocked: u.passUnlocked === true,
  };
};

function sessionFrom(json: Record<string, unknown>): Session {
  const data = (json.data ?? {}) as Record<string, unknown>;
  const user = asUser(data.user);
  const token = typeof data.sessionToken === "string" ? data.sessionToken : "";
  if (!user || !token)
    throw new SessionError("Unexpected answer from the API", 500);
  const sessionMeta = (data.session ?? {}) as Record<string, unknown>;
  return {
    token,
    sessionId: typeof sessionMeta.id === "number" ? sessionMeta.id : null,
    user,
  };
}

export function persistSession(session: Session) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  if (session.sessionId !== null)
    localStorage.setItem(SESSION_ID_KEY, String(session.sessionId));
  else localStorage.removeItem(SESSION_ID_KEY);
}

export function readSession(): Session | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = asUser(JSON.parse(localStorage.getItem(USER_KEY) ?? "null"));
    if (!token || !user) return null;
    const id = Number(localStorage.getItem(SESSION_ID_KEY));
    return {
      token,
      sessionId: Number.isInteger(id) && id > 0 ? id : null,
      user,
    };
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
}

export async function login(
  email: string,
  password: string,
): Promise<LoginStep> {
  const json = await post("/api/auth/login", { email, password });
  const data = (json.data ?? {}) as Record<string, unknown>;
  if (json.requiresTwoFactor === true)
    return {
      type: "twoFactor",
      userId: Number(data.userId),
      challenge: String(data.challenge ?? ""),
    };
  if (json.requiresCode === true)
    return {
      type: "code",
      userId: Number(data.userId),
      email: String(data.email ?? ""),
    };
  const session = sessionFrom(json);
  persistSession(session);
  return { type: "done", session };
}

export async function verifyTwoFactor(
  userId: number,
  challenge: string,
  code: string,
  rememberDevice: boolean,
): Promise<Session> {
  const session = sessionFrom(
    await post("/api/auth/2fa/verify-login", {
      userId,
      challenge,
      code,
      rememberDevice,
    }),
  );
  persistSession(session);
  return session;
}

export async function verifyLoginCode(
  userId: number,
  code: string,
  rememberDevice: boolean,
): Promise<Session> {
  const session = sessionFrom(
    await post("/api/auth/verify-login-code", { userId, code, rememberDevice }),
  );
  persistSession(session);
  return session;
}

export async function refreshUser(): Promise<DesktopUser | null> {
  const current = readSession();
  if (!current) return null;
  try {
    const response = await fetch(`${API_URL}/api/users/id/${current.user.id}`, {
      headers: getAuthHeaders(),
    });
    if (response.status === 401 || response.status === 403) {
      clearSession();
      return null;
    }
    if (!response.ok) return current.user;
    const json = await response.json();
    const user = asUser(json?.data?.user);
    if (!user) return current.user;
    persistSession({ ...current, user });
    return user;
  } catch {
    return current.user;
  }
}

export async function logout() {
  const current = readSession();
  if (current) await clearSnapshot(current.user.id);
  if (current?.sessionId) {
    try {
      await fetch(`${API_URL}/api/sessions/${current.sessionId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch {}
  }
  clearSession();
}