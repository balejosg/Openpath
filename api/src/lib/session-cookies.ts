import type { Request, Response } from 'express';
import { config } from '../config.js';

export interface SessionTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SessionCookieConfig {
  accessCookieName: string;
  refreshCookieName: string;
}

function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey !== name) continue;

    const value = rawValue.join('=');
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

export function getSessionCookieConfig(): SessionCookieConfig | null {
  const accessCookieName = process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME?.trim();
  if (!accessCookieName) {
    return null;
  }

  const refreshCookieName =
    process.env.OPENPATH_REFRESH_TOKEN_COOKIE_NAME?.trim() ?? `${accessCookieName}_refresh`;

  return {
    accessCookieName,
    refreshCookieName,
  };
}

function cookieOptions(expires?: Date): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  expires?: Date;
} {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax' as const,
    path: '/',
    ...(expires !== undefined ? { expires } : {}),
  };
}

export function setSessionCookies(
  res: Pick<Response, 'cookie'>,
  tokens: SessionTokenPair
): boolean {
  const cookieConfig = getSessionCookieConfig();
  if (!cookieConfig) {
    return false;
  }

  res.cookie(cookieConfig.accessCookieName, tokens.accessToken, cookieOptions());
  res.cookie(cookieConfig.refreshCookieName, tokens.refreshToken, cookieOptions());
  return true;
}

export function clearSessionCookies(res: Pick<Response, 'cookie'>): boolean {
  const cookieConfig = getSessionCookieConfig();
  if (!cookieConfig) {
    return false;
  }

  const expiredAt = new Date(0);
  res.cookie(cookieConfig.accessCookieName, '', cookieOptions(expiredAt));
  res.cookie(cookieConfig.refreshCookieName, '', cookieOptions(expiredAt));
  return true;
}

export function readRefreshTokenFromRequest(req: Pick<Request, 'headers'>): string | null {
  const cookieConfig = getSessionCookieConfig();
  if (!cookieConfig) {
    return null;
  }

  return parseCookieValue(req.headers.cookie, cookieConfig.refreshCookieName);
}

export function readAccessTokenFromRequest(req: Pick<Request, 'headers'>): string | null {
  const cookieConfig = getSessionCookieConfig();
  if (!cookieConfig) {
    return null;
  }

  return parseCookieValue(req.headers.cookie, cookieConfig.accessCookieName);
}
