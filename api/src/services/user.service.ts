/**
 * UserService - Business logic for user management
 */

import {
  assignRole,
  createManagedUser,
  createUserWithRole,
  deleteManagedUser,
  deleteUser,
  ensureTeacherRoleGroupAccess,
  register,
  revokeRole,
  updateManagedUser,
  updateUser,
} from './user-management.service.js';
import { getUser, getUserByEmail, listTeachers, listUsers } from './user-query.service.js';
export type { UserResult, UserServiceError, UserWithRoles } from './user-service-shared.js';
export {
  assignRole,
  createManagedUser,
  createUserWithRole,
  deleteManagedUser,
  deleteUser,
  ensureTeacherRoleGroupAccess,
  register,
  revokeRole,
  updateManagedUser,
  updateUser,
} from './user-management.service.js';
export { getUser, getUserByEmail, listTeachers, listUsers } from './user-query.service.js';

export const UserService = {
  listUsers,
  getUser,
  getUserByEmail,
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
  register,
  createUserWithRole,
  updateUser,
  deleteUser,
  assignRole,
  revokeRole,
  listTeachers,
  ensureTeacherRoleGroupAccess,
};

export default UserService;
