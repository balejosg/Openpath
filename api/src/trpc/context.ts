import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import * as auth from '../lib/auth.js';
import type { JWTPayload } from '../lib/auth.js';
import * as roleStorage from '../lib/role-storage.js';
import { logger } from '../lib/logger.js';
import { normalizeUserRoleString } from '@openpath/shared/roles';

export interface Context {
  user: JWTPayload | null;
  req: CreateExpressContextOptions['req'];
  res: CreateExpressContextOptions['res'];
}

function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) {
      const value = rawValue.join('=');
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }

  return null;
}

export async function createContext({ req, res }: CreateExpressContextOptions): Promise<Context> {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') === true ? authHeader.slice(7) : null;

  const cookieName = process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME;
  const cookieToken = cookieName ? parseCookieValue(req.headers.cookie, cookieName) : null;

  let user: JWTPayload | null = null;

  const candidates = [bearerToken, cookieToken].filter((t): t is string => typeof t === 'string');

  for (const token of candidates) {
    user = await auth.verifyAccessToken(token);
    if (user) break;
  }

  // Sync role/group assignments from DB so group permissions don't depend on stale JWT claims.
  if (user) {
    try {
      const dbRoles = await roleStorage.getUserRoles(user.sub);
      const normalizedRoles: JWTPayload['roles'] = [];
      for (const r of dbRoles) {
        const role = normalizeUserRoleString(r.role);
        if (!role) continue;
        normalizedRoles.push({ role, groupIds: r.groupIds ?? [] });
      }

      if (normalizedRoles.length > 0) {
        user = {
          ...user,
          roles: normalizedRoles,
        } as JWTPayload;
      }
    } catch (err) {
      logger.warn('Failed to sync user roles from DB', {
        userId: user.sub,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { user, req, res };
}
