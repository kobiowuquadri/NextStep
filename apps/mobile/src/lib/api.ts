import * as SecureStore from 'expo-secure-store';
import type { AuthResponse } from '@nextstep/contracts';

/** API base URL. Android emulators reach the host machine at 10.0.2.2. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}
export class NetworkError extends Error {}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

const tokenKey = (userId: string) => `ns.tokens.${userId.replace(/[^a-zA-Z0-9]/g, '')}`;

/** Tokens live only in the platform keystore (Android Keystore / iOS Keychain). */
export const tokenStore = {
  async get(userId: string): Promise<Tokens | null> {
    const raw = await SecureStore.getItemAsync(tokenKey(userId));
    return raw ? (JSON.parse(raw) as Tokens) : null;
  },
  async set(userId: string, t: Tokens) {
    await SecureStore.setItemAsync(tokenKey(userId), JSON.stringify(t));
  },
  async clear(userId: string) {
    await SecureStore.deleteItemAsync(tokenKey(userId));
  },
};

async function raw(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 15_000);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  } catch (e) {
    throw new NetworkError((e as Error).name === 'AbortError' ? 'The request timed out.' : 'No connection to NextStep.');
  } finally {
    clearTimeout(timer);
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'HTTP_' + res.status, err?.message ?? 'Request failed', err?.details);
  }
  return body as T;
}

export async function publicRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  return parse<T>(await raw(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }));
}

let refreshing: Promise<Tokens> | null = null;

/** Authenticated request with one transparent refresh on an expired access token. */
export async function authedRequest<T>(userId: string, method: string, path: string, body?: unknown, timeoutMs?: number): Promise<T> {
  const send = async (t: Tokens) =>
    raw(path, { method, timeoutMs, body: body === undefined ? undefined : JSON.stringify(body), headers: { Authorization: `Bearer ${t.accessToken}` } });
  let tokens = await tokenStore.get(userId);
  if (!tokens) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in again.');
  let res = await send(tokens);
  if (res.status === 401) {
    refreshing ??= (async () => {
      const r = await parse<AuthResponse>(await raw('/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: tokens!.refreshToken }) }));
      const next = { accessToken: r.accessToken, refreshToken: r.refreshToken, accessTokenExpiresAt: r.accessTokenExpiresAt };
      await tokenStore.set(userId, next);
      return next;
    })().finally(() => {
      refreshing = null;
    });
    tokens = await refreshing;
    res = await send(tokens);
  }
  return parse<T>(res);
}
