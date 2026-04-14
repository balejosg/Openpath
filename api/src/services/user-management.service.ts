import * as userStorage from '../lib/user-storage.js';
import * as roleStorage from '../lib/role-storage.js';
import { withTransaction } from '../db/index.js';
import type { SafeUser, UserRole, Role } from '../types/index.js';
import type { UpdateUserData, CreateUserData } from '../types/storage.js';
import { getErrorMessage } from '@openpath/shared';
import { getUser } from './user-query.service.js';
import type { UserResult, UserWithRoles } from './user-service-shared.js';
import { mapDBRoleToRole } from './user-service-shared.js';

export async function updateUser(id: string, input: UpdateUserData): Promise<UserResult<SafeUser>> {
  const user = await userStorage.getUserById(id);
  if (!user) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  try {
    const updated = await userStorage.updateUser(id, input);
    if (!updated) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found after update' } };
    }
    return { ok: true, data: updated };
  } catch (error) {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: getErrorMessage(error) },
    };
  }
}

export async function deleteUser(id: string): Promise<UserResult<{ success: boolean }>> {
  const user = await userStorage.getUserById(id);
  if (!user) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  await withTransaction(async (tx) => {
    await roleStorage.revokeAllUserRoles(id, undefined, tx);
    await userStorage.deleteUser(id, tx);
  });

  return { ok: true, data: { success: true } };
}

export async function assignRole(
  userId: string,
  role: UserRole,
  groupIds: string[]
): Promise<UserResult<Role>> {
  const user = await userStorage.getUserById(userId);
  if (!user) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  try {
    const assignedRole = await roleStorage.assignRole({
      userId,
      role,
      groupIds,
    });
    return { ok: true, data: mapDBRoleToRole(assignedRole) };
  } catch (error) {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: getErrorMessage(error) },
    };
  }
}

export async function createUserWithRole(
  input: CreateUserData,
  role?: UserRole,
  groupIds: string[] = []
): Promise<UserResult<{ user: SafeUser }>> {
  try {
    const user = await withTransaction(async (tx) => {
      const createdUser = await userStorage.createUser(input, { emailVerified: true }, tx);

      if (role) {
        await roleStorage.assignRole(
          {
            userId: createdUser.id,
            role,
            groupIds,
          },
          tx
        );
      }

      return createdUser;
    });

    return { ok: true, data: { user } };
  } catch (error) {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: getErrorMessage(error) },
    };
  }
}

export async function createManagedUser(
  input: CreateUserData,
  role?: UserRole,
  groupIds: string[] = []
): Promise<UserResult<UserWithRoles>> {
  const existing = await userStorage.getUserByEmail(input.email);
  if (existing) {
    return { ok: false, error: { code: 'CONFLICT', message: 'Email exists' } };
  }

  const created = await createUserWithRole(input, role, groupIds);
  if (!created.ok) {
    return created;
  }

  return getUser(created.data.user.id);
}

export async function updateManagedUser(
  id: string,
  input: UpdateUserData
): Promise<UserResult<UserWithRoles>> {
  const updated = await updateUser(id, input);
  if (!updated.ok) {
    return updated;
  }

  return getUser(id);
}

export async function deleteManagedUser(
  actorUserId: string,
  targetUserId: string
): Promise<UserResult<{ success: boolean }>> {
  if (actorUserId === targetUserId) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'Cannot delete yourself' } };
  }

  return deleteUser(targetUserId);
}

export async function revokeRole(roleId: string): Promise<UserResult<{ success: boolean }>> {
  const role = await roleStorage.getRoleById(roleId);
  if (!role) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Role not found' } };
  }

  await roleStorage.revokeRole(roleId);
  return { ok: true, data: { success: true } };
}

export async function ensureTeacherRoleGroupAccess(input: {
  userId: string;
  groupId: string;
  createdBy: string;
}): Promise<void> {
  const existingRoles = await roleStorage.getUserRoles(input.userId);
  const teacherRole = existingRoles.find((roleInfo) => roleInfo.role === 'teacher');

  if (!teacherRole) {
    await roleStorage.assignRole({
      userId: input.userId,
      role: 'teacher',
      groupIds: [input.groupId],
      createdBy: input.createdBy,
    });
    return;
  }

  const currentGroups = Array.isArray(teacherRole.groupIds) ? teacherRole.groupIds : [];
  if (currentGroups.includes(input.groupId)) {
    return;
  }

  await roleStorage.addGroupsToRole(teacherRole.id, [input.groupId]);
}

export async function register(input: CreateUserData): Promise<UserResult<{ user: SafeUser }>> {
  try {
    const user = await userStorage.createUser(input, { emailVerified: true });
    return { ok: true, data: { user } };
  } catch (error) {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: getErrorMessage(error) },
    };
  }
}

export const UserManagementService = {
  updateUser,
  deleteUser,
  assignRole,
  createUserWithRole,
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
  revokeRole,
  ensureTeacherRoleGroupAccess,
  register,
};

export default UserManagementService;
