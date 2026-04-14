import { setTimeout as delay } from 'node:timers/promises';

import jwt from 'jsonwebtoken';

import type { AuthResult } from './trpc.js';
import { parseTRPC, trpcMutate } from './trpc.js';
import { uniqueEmail } from './identifiers.js';

export function createLegacyAdminAccessToken(): string {
  const secret = process.env.JWT_SECRET;
  if (secret === undefined || secret === '') {
    throw new Error('JWT_SECRET must be set before creating test admin tokens');
  }

  return jwt.sign(
    {
      sub: 'legacy_admin',
      email: 'admin@openpath.dev',
      name: 'Legacy Admin',
      roles: [{ role: 'admin', groupIds: [] }],
      type: 'access',
    },
    secret,
    {
      issuer: 'openpath-api',
      expiresIn: '1h',
    }
  );
}

export async function bootstrapAdminSession(
  baseUrl: string,
  input: {
    email?: string;
    password?: string;
    name?: string;
  } = {}
): Promise<{ accessToken: string; email: string; password: string }> {
  const email = input.email ?? uniqueEmail('bootstrap-admin');
  const password = input.password ?? 'AdminPassword123!';
  const name = input.name ?? 'Bootstrap Admin';

  const setupResponse = await trpcMutate(baseUrl, 'setup.createFirstAdmin', {
    email,
    password,
    name,
  });
  if (![200, 201, 403, 409].includes(setupResponse.status)) {
    throw new Error(
      `Expected setup.createFirstAdmin to succeed, got ${String(setupResponse.status)}`
    );
  }

  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const loginResponse = await trpcMutate(baseUrl, 'auth.login', {
      email,
      password,
    });
    if (loginResponse.status === 200) {
      const authData = (await parseTRPC(loginResponse)).data as {
        accessToken?: string;
        user?: { roles?: { role?: string }[] };
      };
      const accessToken = authData.accessToken;
      const hasAdminRole = authData.user?.roles?.some((role) => role.role === 'admin') ?? false;

      if (accessToken !== undefined && accessToken !== '' && hasAdminRole) {
        return {
          accessToken,
          email,
          password,
        };
      }
    }

    await delay(100);
  }

  throw new Error('Expected bootstrap admin login to return an admin access token');
}

export async function registerAndVerifyUser(
  baseUrl: string,
  input: {
    email: string;
    password: string;
    name: string;
  },
  headers: Record<string, string> = {}
): Promise<{
  registerResponse: Response;
  registerData?: AuthResult;
  verifyResponse?: Response;
}> {
  const registerResponse = await trpcMutate(baseUrl, 'auth.register', input, headers);
  const { data } = (await parseTRPC(registerResponse)) as { data?: AuthResult };

  if (registerResponse.status !== 200) {
    return data ? { registerResponse, registerData: data } : { registerResponse };
  }

  let verificationToken = data?.verificationToken;
  if (!verificationToken) {
    const { default: AuthService } = await import('../../src/services/auth.service.js');
    const internalResult = await AuthService.generateEmailVerificationToken(input.email);
    if (!internalResult.ok) {
      return data ? { registerResponse, registerData: data } : { registerResponse };
    }
    verificationToken = internalResult.data.verificationToken;
  }

  const verifyResponse = await trpcMutate(
    baseUrl,
    'auth.verifyEmail',
    {
      email: input.email,
      token: verificationToken,
    },
    headers
  );

  return data
    ? {
        registerResponse,
        registerData: data,
        verifyResponse,
      }
    : {
        registerResponse,
        verifyResponse,
      };
}
