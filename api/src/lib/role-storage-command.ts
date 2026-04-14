/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 */

import { v4 as uuidv4 } from 'uuid';
import { eq, sql } from 'drizzle-orm';
import { db, roles } from '../db/index.js';
import type { DbExecutor } from '../db/index.js';
import { getRowCount } from './utils.js';
import type { AssignRoleData, Role } from '../types/storage.js';
import {
  type DBRole,
  normalizeAndValidateRoleGroupIds,
  toRoleType,
} from './role-storage-shared.js';
import { getRoleById } from './role-storage-query.js';

export async function assignRole(
  roleData: AssignRoleData & { createdBy?: string },
  executor: DbExecutor = db
): Promise<DBRole> {
  const { userId, role, groupIds, createdBy } = roleData;
  const validatedGroupIds = await normalizeAndValidateRoleGroupIds(groupIds);

  const existing = await executor.select().from(roles).where(eq(roles.userId, userId)).limit(1);

  if (existing[0]) {
    const updateValues: Partial<typeof roles.$inferInsert> = {
      role,
      groupIds: validatedGroupIds,
    };

    if (createdBy !== undefined) {
      updateValues.createdBy = createdBy;
    }

    const [updated] = await executor
      .update(roles)
      .set(updateValues)
      .where(eq(roles.id, existing[0].id))
      .returning();

    if (!updated) {
      throw new Error(`Failed to update role for user "${userId}"`);
    }

    return updated;
  }

  const id = `role_${uuidv4().slice(0, 8)}`;
  const [created] = await executor
    .insert(roles)
    .values({
      id,
      userId,
      role,
      groupIds: validatedGroupIds,
      createdBy: createdBy ?? null,
    })
    .returning();

  if (!created) {
    throw new Error(`Failed to create role for user "${userId}"`);
  }

  return created;
}

export async function updateRoleGroups(roleId: string, groupIds: string[]): Promise<DBRole | null> {
  const validatedGroupIds = await normalizeAndValidateRoleGroupIds(groupIds);
  const [result] = await db
    .update(roles)
    .set({ groupIds: validatedGroupIds })
    .where(eq(roles.id, roleId))
    .returning();

  return result ?? null;
}

export async function addGroupsToRole(roleId: string, groupIds: string[]): Promise<DBRole | null> {
  const existing = await getRoleById(roleId);
  if (!existing) return null;

  const existingGroups = existing.groupIds ?? [];
  return await updateRoleGroups(roleId, [...new Set([...existingGroups, ...groupIds])]);
}

export async function removeGroupsFromRole(
  roleId: string,
  groupIds: string[]
): Promise<DBRole | null> {
  const existing = await getRoleById(roleId);
  if (!existing) return null;

  const existingGroups = existing.groupIds ?? [];
  return await updateRoleGroups(
    roleId,
    existingGroups.filter((groupId) => !groupIds.includes(groupId))
  );
}

export async function revokeRole(roleId: string, _revokedBy?: string): Promise<boolean> {
  return getRowCount(await db.delete(roles).where(eq(roles.id, roleId))) > 0;
}

export async function revokeAllUserRoles(
  userId: string,
  _revokedBy?: string,
  executor: DbExecutor = db
): Promise<number> {
  return getRowCount(await executor.delete(roles).where(eq(roles.userId, userId)));
}

export async function removeGroupFromAllRoles(groupId: string): Promise<number> {
  const rolesWithGroup = await db
    .select()
    .from(roles)
    .where(sql`${roles.groupIds} @> ARRAY[${groupId}]::text[]`);

  let updatedCount = 0;
  for (const role of rolesWithGroup) {
    const nextGroups = (role.groupIds ?? []).filter((candidate: string) => candidate !== groupId);
    await db.update(roles).set({ groupIds: nextGroups }).where(eq(roles.id, role.id));
    updatedCount++;
  }

  return updatedCount;
}

export async function updateRole(roleId: string, data: Partial<Role>): Promise<Role | null> {
  const updateValues: Partial<typeof roles.$inferInsert> = {};

  if (data.groupIds !== undefined) {
    updateValues.groupIds = await normalizeAndValidateRoleGroupIds(data.groupIds);
  }

  if (Object.keys(updateValues).length === 0) {
    const existing = await getRoleById(roleId);
    return existing ? toRoleType(existing) : null;
  }

  const [result] = await db.update(roles).set(updateValues).where(eq(roles.id, roleId)).returning();
  return result ? toRoleType(result) : null;
}
