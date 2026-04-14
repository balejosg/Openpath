import type { SafeUser, Role } from '../types/index.js';
import { normalizeUserRoleString } from '@openpath/shared/roles';

export type UserServiceError =
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'CONFLICT'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'BAD_REQUEST'; message: string };

export type UserResult<T> = { ok: true; data: T } | { ok: false; error: UserServiceError };

export interface UserWithRoles extends SafeUser {
  roles: Role[];
}

interface DBRole {
  id: string;
  userId: string;
  role: string;
  groupIds: string[] | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  createdBy: string | null;
  expiresAt: Date | null;
}

export function mapDBRoleToRole(roleRecord: DBRole): Role {
  const role = normalizeUserRoleString(roleRecord.role);
  return {
    id: roleRecord.id,
    userId: roleRecord.userId,
    role: role ?? 'student',
    groupIds: roleRecord.groupIds ?? [],
    createdAt: roleRecord.createdAt?.toISOString() ?? new Date().toISOString(),
    expiresAt: roleRecord.expiresAt?.toISOString() ?? null,
  };
}
