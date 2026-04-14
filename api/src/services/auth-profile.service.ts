import * as roleStorage from '../lib/role-storage.js';
import * as userStorage from '../lib/user-storage.js';
import { logger } from '../lib/logger.js';
import type { AuthUser } from '../types/index.js';
import { getErrorMessage } from '@openpath/shared';
import { buildAuthUser, type AuthResult, mapRoleInfo } from './auth-shared.js';

export async function getProfile(userId: string): Promise<AuthResult<{ user: AuthUser }>> {
  const user = await userStorage.getUserById(userId);
  if (!user) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  const roleInfo = mapRoleInfo(await roleStorage.getUserRoles(user.id));
  return { ok: true, data: { user: buildAuthUser(user, roleInfo) } };
}

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

export const AuthProfileService = {
  getProfile,
  changePassword,
};

export default AuthProfileService;
