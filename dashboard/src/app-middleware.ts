import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';

import { createApiClient, type ApiClient } from './api-client.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiClient?: ApiClient;
      accessToken?: string;
    }
  }
}

export function registerCommonMiddleware(app: express.Express, cookieSecret: string): void {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser(cookieSecret));
}

export function getToken(req: Request): string | null {
  const cookieToken = req.signedCookies.access_token as string | undefined;
  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  req.accessToken = token;
  req.apiClient = createApiClient(token);
  next();
}

export function getApiClient(req: Request): ApiClient {
  if (!req.apiClient) {
    throw new Error('API client not initialized - requireAuth middleware must be used');
  }
  return req.apiClient;
}

export function getAccessToken(req: Request): string {
  if (!req.accessToken) {
    throw new Error('Access token not set - requireAuth middleware must be used');
  }
  return req.accessToken;
}

export function getFirstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
