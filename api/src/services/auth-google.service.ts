import { OAuth2Client } from 'google-auth-library';

import * as auth from '../lib/auth.js';
import * as roleStorage from '../lib/role-storage.js';
import * as userStorage from '../lib/user-storage.js';
import { withTransaction } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { config } from '../config.js';
import { getErrorMessage } from '@openpath/shared';

import {
  buildLoginResponse,
  EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  mapRoleInfo,
  type AuthResult,
  type LoginResponse,
} from './auth-shared.js';

const googleClient = new OAuth2Client();
const GOOGLE_VERIFY_TIMEOUT_MS = 15000;

async function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export async function loginWithGoogle(idToken: string): Promise<AuthResult<LoginResponse>> {
  const startTime = Date.now();
  logger.info('auth.loginWithGoogle started');

  try {
    if (!config.googleClientId) {
      logger.warn('auth.loginWithGoogle: Google OAuth not configured');
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Google OAuth not configured' } };
    }

    logger.info('auth.loginWithGoogle: verifying token with Google API...');
    const ticket = await withTimeout(
      googleClient.verifyIdToken({
        idToken,
        audience: config.googleClientId,
      }),
      GOOGLE_VERIFY_TIMEOUT_MS,
      `Google token verification timed out after ${String(GOOGLE_VERIFY_TIMEOUT_MS)}ms`
    );
    logger.info('auth.loginWithGoogle: token verified', { elapsed: Date.now() - startTime });

    const payload = ticket.getPayload();

    if (!payload?.email || !payload.sub) {
      logger.warn('auth.loginWithGoogle: invalid token payload', {
        hasEmail: !!payload?.email,
        hasSub: !!payload?.sub,
      });
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid Google token' } };
    }

    logger.info('auth.loginWithGoogle: looking up user', {
      email: payload.email,
      googleId: payload.sub.slice(0, 8) + '...',
    });
    let user = await userStorage.getUserByGoogleId(payload.sub);
    logger.info('auth.loginWithGoogle: getUserByGoogleId complete', {
      found: !!user,
      elapsed: Date.now() - startTime,
    });

    if (!user) {
      logger.info('auth.loginWithGoogle: user not found by googleId, checking email');
      user = await userStorage.getUserByEmail(payload.email);
      if (user) {
        const existingUser = user;
        logger.info('auth.loginWithGoogle: found user by email, linking googleId');
        await withTransaction(async (tx) => {
          await userStorage.linkGoogleId(existingUser.id, payload.sub, tx);
          if (!existingUser.emailVerified) {
            await userStorage.verifyEmail(existingUser.id, tx);
          }
        });
        user = await userStorage.getUserById(existingUser.id);
      } else {
        logger.warn('auth.loginWithGoogle: rejected unknown Google account', {
          email: payload.email,
          elapsed: Date.now() - startTime,
        });
        return {
          ok: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Google sign-in is only available for existing or preapproved accounts',
          },
        };
      }
    }

    if (!user) {
      return {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Failed to create or find user' },
      };
    }

    if (!user.isActive) {
      return { ok: false, error: { code: 'FORBIDDEN', message: 'Account inactive' } };
    }

    if (user.emailVerified !== true) {
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: EMAIL_VERIFICATION_REQUIRED_MESSAGE },
      };
    }

    const roleInfo = mapRoleInfo(await roleStorage.getUserRoles(user.id));
    const tokens = auth.generateTokens(user, roleInfo);
    return { ok: true, data: buildLoginResponse(tokens, user, roleInfo) };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const elapsed = Date.now() - startTime;
    logger.error('auth.loginWithGoogle error', { error: errorMessage, elapsed });

    if (errorMessage.includes('timed out')) {
      return {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Google verification timed out. Please try again.',
        },
      };
    }

    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Google authentication failed' } };
  }
}

export default {
  loginWithGoogle,
};
