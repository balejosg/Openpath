import { after, afterEach, beforeEach } from 'node:test';

import { OAuth2Client, type LoginTicket } from 'google-auth-library';
import { eq } from 'drizzle-orm';

import { config } from '../src/config.js';
import { closeConnection, db, users } from '../src/db/index.js';
import { resetDb, uniqueEmail } from './test-utils.js';

export const DEFAULT_PASSWORD = 'SecurePassword123!';

export interface TestRole {
  id: string;
  role: string;
  groupIds: string[];
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  emailVerified: boolean;
  roles?: TestRole[];
}

export interface ServiceError {
  code: string;
  message: string;
  field?: string;
}

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ServiceError };

const originalGoogleClientId = config.googleClientId;
const originalVerifyIdToken = Reflect.get(OAuth2Client.prototype, 'verifyIdToken');

export interface GooglePayload {
  email?: string;
  sub?: string;
  name?: string;
}

export function registerServiceCoverageLifecycle(): void {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    setGoogleClientId(originalGoogleClientId);
    OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;
  });

  after(async () => {
    await closeConnection();
  });
}

export function stubGooglePayload(payload: GooglePayload): void {
  const ticket = {
    getPayload: () => payload,
  } as unknown as LoginTicket;

  OAuth2Client.prototype.verifyIdToken = (() =>
    Promise.resolve(ticket)) as unknown as OAuth2Client['verifyIdToken'];
}

export function stubGoogleError(message: string): void {
  OAuth2Client.prototype.verifyIdToken = ((): never => {
    throw new Error(message);
  }) as unknown as OAuth2Client['verifyIdToken'];
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId));
}

export function setGoogleClientId(value: string): void {
  Object.defineProperty(config, 'googleClientId', {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

export function expectOk<T>(result: ServiceResult<T>, message: string): T {
  if (!result.ok) {
    throw new Error(message);
  }
  return result.data;
}

export { db, uniqueEmail };
