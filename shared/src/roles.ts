import type { UserRole } from './schemas/index.js';

export type LegacyUserRole = 'openpath-admin' | 'user' | 'viewer';

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
