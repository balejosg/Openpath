import * as userStorage from '../lib/user-storage.js';
import * as resetTokenStorage from '../lib/reset-token-storage.js';
import * as emailVerificationTokenStorage from '../lib/email-verification-token-storage.js';
import type { DbExecutor } from '../db/index.js';
import { withTransaction } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { getErrorMessage } from '@openpath/shared';

import type { AuthResult, EmailVerificationTokenResponse } from './auth-shared.js';

export async function issueEmailVerificationToken(
  user: {
    id: string;
    email: string;
  },
  executor?: DbExecutor
): Promise<EmailVerificationTokenResponse> {
  const { token, expiresAt } = await emailVerificationTokenStorage.createEmailVerificationToken(
    user.id,
    executor
  );

  return {
    email: user.email,
    verificationRequired: true,
    verificationToken: token,
    verificationExpiresAt: expiresAt.toISOString(),
  };
}

export async function generateEmailVerificationToken(
  email: string
): Promise<AuthResult<EmailVerificationTokenResponse>> {
  try {
    const user = await userStorage.getUserByEmail(email);
    if (!user) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
    }

    if (user.emailVerified) {
      return {
        ok: false,
        error: { code: 'CONFLICT', message: 'Email is already verified' },
      };
    }

    return {
      ok: true,
      data: await withTransaction(async (tx) => issueEmailVerificationToken(user, tx)),
    };
  } catch (error) {
    logger.error('auth.generateEmailVerificationToken error', {
      error: getErrorMessage(error),
    });
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: getErrorMessage(error) },
    };
  }
}

export async function verifyEmail(
  email: string,
  token: string
): Promise<AuthResult<{ success: boolean }>> {
  try {
    const user = await userStorage.getUserByEmail(email);
    if (!user) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
    }

    if (user.emailVerified) {
      return { ok: true, data: { success: true } };
    }

    const verified = await withTransaction(async (tx) => {
      const isValid = await emailVerificationTokenStorage.verifyEmailVerificationToken(
        user.id,
        token,
        tx
      );
      if (!isValid) {
        return false;
      }

      return await userStorage.verifyEmail(user.id, tx);
    });

    if (!verified) {
      return {
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid or expired verification token' },
      };
    }

    return { ok: true, data: { success: true } };
  } catch (error) {
    logger.error('auth.verifyEmail error', { error: getErrorMessage(error) });
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: getErrorMessage(error) },
    };
  }
}

export async function generateResetToken(email: string): Promise<AuthResult<{ token: string }>> {
  try {
    const user = await userStorage.getUserByEmail(email);
    if (!user) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
    }

    const token = await resetTokenStorage.createResetToken(user.id);
    return { ok: true, data: { token } };
  } catch (error) {
    logger.error('auth.generateResetToken error', { error: getErrorMessage(error) });
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: getErrorMessage(error) },
    };
  }
}

export async function resetPassword(
  email: string,
  token: string,
  newPassword: string
): Promise<AuthResult<{ success: boolean }>> {
  try {
    const user = await userStorage.getUserByEmail(email);
    if (!user) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
    }

    const reset = await withTransaction(async (tx) => {
      const isValid = await resetTokenStorage.verifyToken(user.id, token, tx);
      if (!isValid) {
        return false;
      }

      const updated = await userStorage.updateUser(user.id, { password: newPassword }, tx);
      return updated !== null;
    });

    if (!reset) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } };
    }

    return { ok: true, data: { success: true } };
  } catch (error) {
    logger.error('auth.resetPassword error', { error: getErrorMessage(error) });
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: getErrorMessage(error) },
    };
  }
}

export default {
  issueEmailVerificationToken,
  generateEmailVerificationToken,
  verifyEmail,
  generateResetToken,
  resetPassword,
};
