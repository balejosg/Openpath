import { after, afterEach, before } from 'node:test';

import { OAuth2Client, type LoginTicket } from 'google-auth-library';

import { config, loadConfig } from '../src/config.js';
import * as authLib from '../src/lib/auth.js';
import * as userStorage from '../src/lib/user-storage.js';
import { startHttpTestHarness, type HttpTestHarness } from './http-test-harness.js';
import { uniqueEmail } from './test-utils.js';

const DEFAULT_READY_DELAY_MS = 1_000;
const DEFAULT_PASSWORD = 'SecurePassword123!';
const TEST_GOOGLE_CLIENT_ID = 'test-google-client-id';
const originalGoogleClientId = config.googleClientId;
const originalVerifyIdToken = Reflect.get(OAuth2Client.prototype, 'verifyIdToken');

let harness: HttpTestHarness | undefined;

export interface TRPCResponse<T = unknown> {
  result?: { data: T };
  error?: { message: string; code: string };
}

export interface AuthResult {
  success?: boolean;
  user?: { id: string; email: string; name: string; roles?: { role: string }[] };
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  sessionTransport?: 'token' | 'cookie';
  verificationRequired?: boolean;
  verificationToken?: string;
  verificationExpiresAt?: string;
  error?: string;
}

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  emailVerified: boolean;
  googleId: string | null;
}

export interface GooglePayload {
  email?: string;
  sub?: string;
  name?: string;
}

export function registerAuthHttpLifecycle(): void {
  before(async () => {
    setGoogleClientId(TEST_GOOGLE_CLIENT_ID);
    harness = await startHttpTestHarness({
      readyDelayMs: DEFAULT_READY_DELAY_MS,
      resetDb: true,
    });
    await harness.bootstrapAdminSession({
      email: uniqueAuthEmail('bootstrap-admin'),
      name: 'Bootstrap Admin',
      password: DEFAULT_PASSWORD,
    });
  });

  afterEach(() => {
    setGoogleClientId(TEST_GOOGLE_CLIENT_ID);
    OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;
  });

  after(async () => {
    await harness?.close();
    harness = undefined;
    setGoogleClientId(originalGoogleClientId);
    OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;
  });
}

function getHarness(): HttpTestHarness {
  if (harness === undefined) {
    throw new Error('Auth HTTP harness has not been initialized');
  }

  return harness;
}

export function uniqueAuthEmail(prefix: string): string {
  return uniqueEmail(prefix);
}

export function createLegacyAdminAccessToken(): string {
  return authLib.generateTokens(
    {
      id: 'legacy_admin',
      email: 'admin@openpath.dev',
      name: 'Legacy Admin',
      passwordHash: 'placeholder',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    },
    [{ role: 'admin', groupIds: [] }]
  ).accessToken;
}

export async function trpcMutate(
  procedure: string,
  input: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  return getHarness().trpcMutate(procedure, input, headers);
}

export async function trpcQuery(
  procedure: string,
  input?: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  return getHarness().trpcQuery(procedure, input, headers);
}

export async function parseTRPC(
  response: Response
): Promise<{ data?: unknown; error?: string; code?: string }> {
  const json = (await response.json()) as TRPCResponse;
  if (json.result !== undefined) {
    return { data: json.result.data };
  }
  if (json.error !== undefined) {
    return { code: json.error.code, error: json.error.message };
  }
  return {};
}

export function setGoogleClientId(value: string): void {
  Object.defineProperty(config, 'googleClientId', {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

export function stubGooglePayload(payload: GooglePayload): void {
  const ticket = {
    getPayload: (): GooglePayload => payload,
  } as unknown as LoginTicket;

  OAuth2Client.prototype.verifyIdToken = (() =>
    Promise.resolve(ticket)) as unknown as OAuth2Client['verifyIdToken'];
}

export function stubGoogleError(message: string): void {
  OAuth2Client.prototype.verifyIdToken = ((): never => {
    throw new Error(message);
  }) as unknown as OAuth2Client['verifyIdToken'];
}

export async function createVerifiedUser(input: {
  email?: string;
  name: string;
  password?: string;
}): Promise<{ email: string; password: string }> {
  const email = input.email ?? uniqueAuthEmail(input.name.toLowerCase().replace(/\s+/g, '-'));
  const password = input.password ?? DEFAULT_PASSWORD;

  await userStorage.createUser(
    {
      email,
      name: input.name,
      password,
    },
    { emailVerified: true }
  );

  return { email, password };
}

export async function createUserAccessToken(input: { email: string }): Promise<string> {
  const user = (await userStorage.getUserByEmail(input.email)) as StoredUser | null;
  if (user === null) {
    throw new Error(`Expected user ${input.email} to exist`);
  }
  return authLib.generateTokens(
    {
      ...user,
      googleId: user.googleId ?? undefined,
    },
    []
  ).accessToken;
}

export function loadTestConfigWithoutJwtSecret(): string {
  return loadConfig({
    ...process.env,
    JWT_SECRET: undefined,
    NODE_ENV: 'test',
  }).jwtSecret;
}

export { DEFAULT_PASSWORD, authLib, userStorage };
