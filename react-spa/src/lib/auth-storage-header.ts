import { COOKIE_SESSION_MARKER, getCanonicalAccessToken } from './auth-storage-core';
import { getLegacyAuthToken } from './auth-storage-legacy';

/**
 * Token used for Authorization header.
 * Prefers the canonical access token and only falls back to the legacy
 * requests token when the active session is cookie-backed or absent.
 */
export function getAuthTokenForHeader(): string | null {
  const accessToken = getCanonicalAccessToken();
  if (accessToken && accessToken !== COOKIE_SESSION_MARKER) {
    return accessToken;
  }

  return getLegacyAuthToken();
}
