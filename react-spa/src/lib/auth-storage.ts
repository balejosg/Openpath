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
import {
  LEGACY_TOKEN_KEY,
  clearLegacyAuthStorage,
  resolveAuthorizationHeaderToken,
} from './auth-storage-legacy';

export { ACCESS_TOKEN_KEY, COOKIE_SESSION_MARKER, LEGACY_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY };

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

/**
 * Token used for Authorization header.
 * Prefers access token, falls back to the legacy token if present.
 */
export function getAuthTokenForHeader(): string | null {
  return resolveAuthorizationHeaderToken();
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
