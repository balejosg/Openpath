/**
 * AuthService - Business logic for authentication
 */

import * as auth from '../lib/auth.js';
import * as roleStorage from '../lib/role-storage.js';
import * as userStorage from '../lib/user-storage.js';
import { withTransaction } from '../db/index.js';
import { logger } from '../lib/logger.js';
import type { AuthUser } from '../types/index.js';
import type { CreateUserData } from '../types/storage.js';
import { getErrorMessage } from '@openpath/shared';

import AccountRecoveryService, {
  issueEmailVerificationToken,
} from './auth-account-recovery.service.js';
import GoogleAuthService from './auth-google.service.js';
import {
  buildAuthUser,
  buildLoginResponse,
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  mapRoleInfo,
  type AuthResult,
  type AuthServiceError,
  type EmailVerificationTokenResponse,
  type LoginResponse,
  type RegisterResponse,
  type TokenPair,
} from './auth-shared.js';

export type {
  AuthResult,
  AuthServiceError,
  EmailVerificationTokenResponse,
  RegisterResponse,
  TokenPair,
};

export { EMAIL_VERIFICATION_REQUIRED_MESSAGE };

/**
 * Register a new user
 */
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

/**
 * Login user and return tokens
 */
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

/**
 * Refresh access token
 */
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

/**
 * Logout user
 */
export async function logout(
  accessToken?: string,
  refreshToken?: string
): Promise<AuthResult<{ success: boolean }>> {
  await withTransaction(async (tx) => {
    if (accessToken) await auth.blacklistToken(accessToken, tx);
    if (refreshToken) await auth.blacklistToken(refreshToken, tx);
  });
  return { ok: true, data: { success: true } };
}

/**
 * Get user profile
 */
export async function getProfile(userId: string): Promise<AuthResult<{ user: AuthUser }>> {
  const user = await userStorage.getUserById(userId);
  if (!user) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  const roleInfo = mapRoleInfo(await roleStorage.getUserRoles(user.id));

  return { ok: true, data: { user: buildAuthUser(user, roleInfo) } };
}

/**
 * Change password for an authenticated user.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<AuthResult<{ success: boolean }>> {
  try {
    if (!currentPassword || !newPassword) {
      return {
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Current and new password are required' },
      };
    }

    if (newPassword.length < 8) {
      return {
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'New password must be at least 8 characters' },
      };
    }

    const user = await userStorage.getUserById(userId);
    if (!user) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
    }

    const isValidCurrentPassword = await userStorage.verifyPassword(user, currentPassword);
    if (!isValidCurrentPassword) {
      return {
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Current password is incorrect' },
      };
    }

    await userStorage.updateUser(user.id, { password: newPassword });
    return { ok: true, data: { success: true } };
  } catch (error) {
    logger.error('auth.changePassword error', { error: getErrorMessage(error) });
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: getErrorMessage(error) },
    };
  }
}

export const generateEmailVerificationToken = AccountRecoveryService.generateEmailVerificationToken;
export const verifyEmail = AccountRecoveryService.verifyEmail;
export const generateResetToken = AccountRecoveryService.generateResetToken;
export const resetPassword = AccountRecoveryService.resetPassword;
export const loginWithGoogle = GoogleAuthService.loginWithGoogle;

export default {
  register,
  login,
  loginWithGoogle,
  refresh,
  logout,
  getProfile,
  generateEmailVerificationToken,
  verifyEmail,
  generateResetToken,
  resetPassword,
  changePassword,
};
