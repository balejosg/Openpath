/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 */

import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { db, roles } from '../db/index.js';
import type { Role } from '../types/storage.js';
import type { UserRole } from '../types/index.js';
import {
  type DBRole,
  type RoleStats,
  type TeacherInfo,
  toRoleType,
} from './role-storage-shared.js';
import { getDbRoleValues } from './role-storage-legacy.js';
import { normalizeUserRoleString } from '@openpath/shared/roles';

export async function getUserRoles(userId: string): Promise<DBRole[]> {
  return await db.select().from(roles).where(eq(roles.userId, userId));
}

export async function getUsersByRole(role: UserRole): Promise<DBRole[]> {
  return await db
    .select()
    .from(roles)
    .where(inArray(roles.role, getDbRoleValues(role)));
}

export async function getAllTeachers(): Promise<TeacherInfo[]> {
  const result = await getUsersByRole('teacher');

  return result.map((role) => ({
    userId: role.userId,
    groupIds: role.groupIds ?? [],
    createdAt: role.createdAt?.toISOString() ?? new Date().toISOString(),
    createdBy: role.createdBy ?? 'unknown',
  }));
}

export async function getAllAdmins(): Promise<DBRole[]> {
  return await getUsersByRole('admin');
}

export async function hasAnyAdmins(): Promise<boolean> {
  const result = await db
    .select({ id: roles.id })
    .from(roles)
    .where(inArray(roles.role, getDbRoleValues('admin')))
    .limit(1);

  return result.length > 0;
}

export async function hasRole(userId: string, role: UserRole): Promise<boolean> {
  const result = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.userId, userId), inArray(roles.role, getDbRoleValues(role))))
    .limit(1);

  return result.length > 0;
}

export async function isAdmin(userId: string): Promise<boolean> {
  return await hasRole(userId, 'admin');
}

export async function canApproveForGroup(userId: string, groupId: string): Promise<boolean> {
  if (await isAdmin(userId)) {
    return true;
  }

  const result = await db
    .select({ groupIds: roles.groupIds })
    .from(roles)
    .where(
      and(
        eq(roles.userId, userId),
        eq(roles.role, 'teacher'),
        sql`${roles.groupIds} @> ARRAY[${groupId}]::text[]`
      )
    )
    .limit(1);

  return result.length > 0;
}

export async function getApprovalGroups(userId: string): Promise<string[] | 'all'> {
  if (await isAdmin(userId)) {
    return 'all';
  }

  const result = await db
    .select({ groupIds: roles.groupIds })
    .from(roles)
    .where(and(eq(roles.userId, userId), eq(roles.role, 'teacher')))
    .limit(1);

  return result[0]?.groupIds ?? [];
}

export async function getRoleById(roleId: string): Promise<DBRole | null> {
  const result = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  return result[0] ?? null;
}

export async function getRolesByUser(userId: string): Promise<Role[]> {
  const result = await getUserRoles(userId);
  return result.map(toRoleType);
}

export async function getUsersWithRole(role: UserRole): Promise<string[]> {
  const result = await getUsersByRole(role);
  return result.map((dbRole) => dbRole.userId);
}

export async function getStats(): Promise<RoleStats> {
  const result = await db
    .select({
      role: roles.role,
      count: count(),
    })
    .from(roles)
    .groupBy(roles.role);

  const stats: RoleStats = {
    total: 0,
    active: 0,
    admins: 0,
    teachers: 0,
    students: 0,
  };

  result.forEach((row) => {
    const countValue = row.count;
    stats.total += countValue;
    stats.active += countValue;

    const normalizedRole = normalizeUserRoleString(row.role);
    if (normalizedRole === 'admin') stats.admins += countValue;
    if (normalizedRole === 'teacher') stats.teachers += countValue;
    if (normalizedRole === 'student') stats.students += countValue;
  });

  return stats;
}
