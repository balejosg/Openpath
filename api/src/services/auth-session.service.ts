import * as auth from '../lib/auth.js';
import * as roleStorage from '../lib/role-storage.js';
import * as userStorage from '../lib/user-storage.js';
import { withTransaction } from '../db/index.js';
import { logger } from '../lib/logger.js';
import type { CreateUserData } from '../types/storage.js';
import { getErrorMessage } from '@openpath/shared';
import { issueEmailVerificationToken } from './auth-account-recovery.service.js';
import {
  buildAuthUser,
  buildLoginResponse,
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  mapRoleInfo,
  type AuthResult,
  type LoginResponse,
  type RegisterResponse,
  type TokenPair,
} from './auth-shared.js';

export async function register(input: CreateUserData): Promise<AuthResult<RegisterResponse>> {
  try {
    if (await userStorage.emailExists(input.email)) {
      return {
        ok: false,
        error: { code: 'CONFLICT', message: 'Email already registered' },
      };
    }

    const { user, verification } = await withTransaction(async (tx) => {
      const createdUser = await userStorage.createUser(input, { emailVerified: false }, tx);
      const createdVerification = await issueEmailVerificationToken(createdUser, tx);

      return {
        user: createdUser,
        verification: createdVerification,
      };
    });

    const roleInfo = mapRoleInfo(await roleStorage.getUserRoles(user.id));

    return {
      ok: true,
      data: {
        user: buildAuthUser(user, roleInfo),
        verificationRequired: true,
        verificationToken: verification.verificationToken,
        verificationExpiresAt: verification.verificationExpiresAt,
      },
    };
  } catch (error) {
    logger.error('auth.register error', { error: getErrorMessage(error) });
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: getErrorMessage(error) },
    };
  }
}

export async function login(email: string, password: string): Promise<AuthResult<LoginResponse>> {
  try {
    const user = await userStorage.verifyPasswordByEmail(email, password);
    if (!user) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } };
    }
    if (!user.isActive) {
      return { ok: false, error: { code: 'FORBIDDEN', message: 'Account inactive' } };
    }
    if (!user.emailVerified) {
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: EMAIL_VERIFICATION_REQUIRED_MESSAGE },
      };
    }

    const roleInfo = mapRoleInfo(await roleStorage.getUserRoles(user.id));
    const tokens = auth.generateTokens(user, roleInfo);
    return { ok: true, data: buildLoginResponse(tokens, user, roleInfo) };
  } catch (error) {
    logger.error('auth.login error', { error: getErrorMessage(error) });
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: getErrorMessage(error) },
    };
  }
}

export async function refresh(refreshToken: string): Promise<AuthResult<TokenPair>> {
  const decoded = await auth.verifyRefreshToken(refreshToken);
  if (!decoded) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } };
  }

  const user = await userStorage.getUserById(decoded.sub);
  if (user?.isActive !== true || user.emailVerified !== true) {
    return {
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message:
          user?.emailVerified === false
            ? EMAIL_VERIFICATION_REQUIRED_MESSAGE
            : 'User not found or inactive',
      },
    };
  }

  await auth.blacklistToken(refreshToken);
  const roleInfo = mapRoleInfo(await roleStorage.getUserRoles(user.id));
  const tokens = auth.generateTokens(user, roleInfo);

  return { ok: true, data: tokens as TokenPair };
}

export async function logout(
  accessToken?: string,
  refreshToken?: string
): Promise<AuthResult<{ success: boolean }>> {
  await withTransaction(async (tx) => {
    if (accessToken) {
      await auth.blacklistToken(accessToken, tx);
    }
    if (refreshToken) {
      await auth.blacklistToken(refreshToken, tx);
    }
  });

  return { ok: true, data: { success: true } };
}

export const AuthSessionService = {
  register,
  login,
  refresh,
  logout,
};

export default AuthSessionService;
