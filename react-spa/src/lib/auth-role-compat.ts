import {
  hasNormalizedUserRole,
  normalizeUserRoleString,
  type LegacyUserRole,
} from '@openpath/shared/roles';
import type { UserRole } from '@openpath/shared';

export type BackendRole = UserRole | LegacyUserRole;

export function userHasRole(
  roles: { role: BackendRole; groupIds?: string[] }[] | undefined,
  expectedRole: UserRole
): boolean {
  if (!Array.isArray(roles)) {
    return false;
  }

  return roles.some((entry) => hasNormalizedUserRole(entry.role, expectedRole));
}

export function normalizeBackendRole(role: string): UserRole | null {
  return normalizeUserRoleString(role);
}
