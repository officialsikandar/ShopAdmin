const TOKEN_KEY = 'shopadmin_customer_token';
const GUEST_CART_KEY = 'shopadmin_guest_cart';
const GUEST_WISHLIST_KEY = 'shopadmin_guest_wishlist';
const RECENTLY_VIEWED_KEY = 'shopadmin_recently_viewed';
const BUY_NOW_KEY = 'shopadmin_buy_now_item';

export class StoreApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getCustomerToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setCustomerToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export async function storeApi<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getCustomerToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const rawText = await res.text();
      if (rawText) {
        try {
          const data = JSON.parse(rawText) as { error?: string; code?: string };
          if (data?.error) errMsg = data.error;
          if (data?.code) code = data.code;
        } catch {
          errMsg = rawText.slice(0, 180);
        }
      }
    } catch {
      // ignore body read error
    }
    if (res.status === 401 && code === 'SESSION_EXPIRED') {
      setCustomerToken(null);
    }
    throw new StoreApiError(errMsg, res.status, code);
  }

  return res.json() as Promise<T>;
}

export function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLocalJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

export const STORAGE_KEYS = {
  GUEST_CART_KEY,
  GUEST_WISHLIST_KEY,
  RECENTLY_VIEWED_KEY,
  BUY_NOW_KEY,
};
