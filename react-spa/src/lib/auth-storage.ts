import {
  ACCESS_TOKEN_KEY,
  COOKIE_SESSION_MARKER,
  REFRESH_TOKEN_KEY,
  USER_KEY,
  getCanonicalAccessToken,
  getCanonicalRefreshToken,
  getCanonicalUserJson,
  safeRemoveStorageItem,
  safeSetStorageItem,
} from './auth-storage-core';
import { LEGACY_TOKEN_KEY, clearLegacyAuthStorage } from './auth-storage-legacy';
import { getAuthTokenForHeader } from './auth-storage-header';

export { ACCESS_TOKEN_KEY, COOKIE_SESSION_MARKER, LEGACY_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY };
export { getAuthTokenForHeader };

export function getAccessToken(): string | null {
  return getCanonicalAccessToken();
}

export function getRefreshToken(): string | null {
  return getCanonicalRefreshToken();
}

export function getUserJson(): string | null {
  return getCanonicalUserJson();
}

export function setAuthSession(
  accessToken: string,
  refreshToken: string,
  user: unknown,
  sessionTransport: 'token' | 'cookie' = 'token'
): void {
  if (sessionTransport === 'cookie') {
    safeSetStorageItem(ACCESS_TOKEN_KEY, COOKIE_SESSION_MARKER);
    safeRemoveStorageItem(REFRESH_TOKEN_KEY);
    clearLegacyAuthStorage();
  } else {
    safeSetStorageItem(ACCESS_TOKEN_KEY, accessToken);
    safeSetStorageItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  try {
    safeSetStorageItem(USER_KEY, JSON.stringify(user));
  } catch {
    safeRemoveStorageItem(USER_KEY);
  }
}

export function clearAuthStorage(): void {
  safeRemoveStorageItem(ACCESS_TOKEN_KEY);
  safeRemoveStorageItem(REFRESH_TOKEN_KEY);
  safeRemoveStorageItem(USER_KEY);
  clearLegacyAuthStorage();
}

export function clearAuthAndReload(): void {
  clearAuthStorage();
  try {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  } catch {
    // ignore
  }
}
