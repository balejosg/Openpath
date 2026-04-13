import { after, before } from 'node:test';

import type { HttpTestHarness } from './http-test-harness.js';

const JWT_SECRET = 'test-secret-123';

process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'development';
process.env.ENABLE_RATE_LIMIT_IN_TEST = 'true';
process.env.TRUST_PROXY = '1';
process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = 'op_access';
process.env.OPENPATH_REFRESH_TOKEN_COOKIE_NAME = 'op_refresh';

let harness: HttpTestHarness | undefined;

export interface SecurityResponse {
  body: unknown;
  headers: Headers;
  status: number;
}

export function registerSecurityLifecycle(): void {
  before(async () => {
    const { startHttpTestHarness } = await import('./http-test-harness.js');

    harness = await startHttpTestHarness({
      env: {
        ENABLE_RATE_LIMIT_IN_TEST: 'true',
        JWT_SECRET,
        NODE_ENV: 'development',
        OPENPATH_ACCESS_TOKEN_COOKIE_NAME: 'op_access',
        OPENPATH_REFRESH_TOKEN_COOKIE_NAME: 'op_refresh',
        TRUST_PROXY: '1',
      },
      readyDelayMs: 1_000,
      resetDb: true,
    });
  });

  after(async () => {
    await harness?.close();
    harness = undefined;
  });
}

function getHarness(): HttpTestHarness {
  if (harness === undefined) {
    throw new Error('Security HTTP harness has not been initialized');
  }

  return harness;
}

export async function request(path: string, options: RequestInit = {}): Promise<SecurityResponse> {
  const requestHeaders = new Headers(options.headers);
  if (!requestHeaders.has('Connection')) {
    requestHeaders.set('Connection', 'close');
  }

  const response = await fetch(`${getHarness().apiUrl}${path}`, {
    ...options,
    headers: requestHeaders,
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { body, headers: response.headers, status: response.status };
}

export async function createAccessToken(payload: {
  email: string;
  name: string;
  roles: { groupIds: string[]; role: 'admin' | 'teacher' | 'student' }[];
  sub: string;
}): Promise<string> {
  const auth = await import('../src/lib/auth.js');

  return auth.generateAccessToken(
    {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      passwordHash: 'placeholder',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    },
    payload.roles
  );
}

export { JWT_SECRET };
