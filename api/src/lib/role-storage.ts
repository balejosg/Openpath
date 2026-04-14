/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 *
 * Role Storage - PostgreSQL-based role management using Drizzle ORM
 */

import { logger } from './logger.js';
import type { AssignRoleData, IRoleStorage } from '../types/storage.js';
import { assignRole, revokeAllUserRoles, revokeRole, updateRole } from './role-storage-command.js';
import { getRoleById, getRolesByUser, getUsersWithRole } from './role-storage-query.js';
import { toRoleType } from './role-storage-shared.js';

export * from './role-storage-shared.js';
export * from './role-storage-query.js';
export * from './role-storage-command.js';

export const roleStorage: IRoleStorage = {
  getRolesByUser,
  getRoleById: async (roleId: string) => {
    const result = await getRoleById(roleId);
    return result ? toRoleType(result) : null;
  },
  getUsersWithRole,
  assignRole: async (data: AssignRoleData) => toRoleType(await assignRole(data)),
  updateRole,
  revokeRole,
  revokeAllUserRoles,
};

logger.debug('Role storage initialized');

export default roleStorage;
