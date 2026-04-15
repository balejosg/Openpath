export const ACCESS_TOKEN_KEY = 'openpath_access_token';
export const REFRESH_TOKEN_KEY = 'openpath_refresh_token';
export const USER_KEY = 'openpath_user';
export const COOKIE_SESSION_MARKER = 'cookie-session';

export function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function safeGetStorageItem(key: string): string | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetStorageItem(key: string, value: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function safeRemoveStorageItem(key: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getCanonicalAccessToken(): string | null {
  return safeGetStorageItem(ACCESS_TOKEN_KEY);
}

export function getCanonicalRefreshToken(): string | null {
  return safeGetStorageItem(REFRESH_TOKEN_KEY);
}

export function getCanonicalUserJson(): string | null {
  return safeGetStorageItem(USER_KEY);
}
