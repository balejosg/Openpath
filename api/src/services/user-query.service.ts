import * as userStorage from '../lib/user-storage.js';
import * as roleStorage from '../lib/role-storage.js';
import type { User } from '../types/index.js';
import type { UserResult, UserWithRoles } from './user-service-shared.js';

export async function listUsers(): Promise<UserWithRoles[]> {
  const users = await userStorage.getAllUsers();
  const result: UserWithRoles[] = [];

  for (const user of users) {
    const roles = await roleStorage.getRolesByUser(user.id);
    result.push({
      ...user,
      roles,
    });
  }

  return result;
}

export async function getUser(id: string): Promise<UserResult<UserWithRoles>> {
  const user = await userStorage.getUserById(id);
  if (!user) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } };
  }

  const roles = await roleStorage.getRolesByUser(user.id);
  return {
    ok: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles,
    },
  };
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return userStorage.getUserByEmail(email);
}

export async function listTeachers(): Promise<roleStorage.TeacherInfo[]> {
  return roleStorage.getAllTeachers();
}

export const UserQueryService = {
  listUsers,
  getUser,
  getUserByEmail,
  listTeachers,
};

export default UserQueryService;
