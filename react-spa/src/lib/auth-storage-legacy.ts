import {
  COOKIE_SESSION_MARKER,
  getCanonicalAccessToken,
  safeGetStorageItem,
  safeRemoveStorageItem,
} from './auth-storage-core';

export const LEGACY_TOKEN_KEY = 'requests_api_token';

export function getLegacyAuthToken(): string | null {
  return safeGetStorageItem(LEGACY_TOKEN_KEY);
}

export function resolveAuthorizationHeaderToken(): string | null {
  const accessToken = getCanonicalAccessToken();
  if (accessToken && accessToken !== COOKIE_SESSION_MARKER) {
    return accessToken;
  }

  return getLegacyAuthToken();
}

export function clearLegacyAuthStorage(): void {
  safeRemoveStorageItem(LEGACY_TOKEN_KEY);
}
