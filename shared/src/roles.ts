import type { UserRole } from './schemas/index.js';

export type LegacyUserRole = 'openpath-admin' | 'user' | 'viewer';
const ROLE_STORAGE_ALIASES: Record<UserRole, readonly string[]> = {
  admin: ['admin', 'openpath-admin'],
  teacher: ['teacher'],
  student: ['student', 'user', 'viewer'],
};

/**
 * Normalize a role string to the canonical OpenPath roles.
 *
 * Canonical roles are defined in @openpath/shared schemas:
 * - admin | teacher | student
 *
 * Legacy aliases accepted for backward compatibility:
 * - openpath-admin -> admin
 * - user/viewer -> student
 */
export function normalizeUserRoleString(input: unknown): UserRole | null {
  if (typeof input !== 'string') return null;

  const role = input.trim().toLowerCase();
  if (role === 'admin' || role === 'teacher' || role === 'student') {
    return role;
  }

  if (role === 'openpath-admin') return 'admin';
  if (role === 'user' || role === 'viewer') return 'student';

  return null;
}

export function hasNormalizedUserRole(input: unknown, expectedRole: UserRole): boolean {
  return normalizeUserRoleString(input) === expectedRole;
}

export function getStoredRoleAliases(role: UserRole): readonly string[] {
  return ROLE_STORAGE_ALIASES[role];
}
