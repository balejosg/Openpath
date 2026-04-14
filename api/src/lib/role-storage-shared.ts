/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 */

import { inArray } from 'drizzle-orm';
import { db, roles, whitelistGroups } from '../db/index.js';
import { logger } from './logger.js';
import type { UserRole } from '../types/index.js';
import type { Role } from '../types/storage.js';
import { normalizeUserRoleString } from '@openpath/shared/roles';

export type DBRole = typeof roles.$inferSelect;

export interface RoleStats {
  total: number;
  active: number;
  admins: number;
  teachers: number;
  students: number;
}

export interface TeacherInfo {
  userId: string;
  groupIds: string[];
  createdAt: string;
  createdBy: string;
}

export function toRoleType(dbRole: DBRole): Role {
  const role = normalizeUserRoleString(dbRole.role);
  if (!role) {
    logger.warn('Unknown role value in DB; defaulting to student', {
      userId: dbRole.userId,
      role: dbRole.role,
    });
  }

  return {
    id: dbRole.id,
    userId: dbRole.userId,
    role: role ?? 'student',
    groupIds: dbRole.groupIds ?? [],
    createdAt: dbRole.createdAt?.toISOString() ?? new Date().toISOString(),
    expiresAt: null,
  };
}

export function getDbRoleValues(role: UserRole): string[] {
  switch (role) {
    case 'admin':
      return ['admin', 'openpath-admin'];
    case 'teacher':
      return ['teacher'];
    case 'student':
      return ['student', 'user', 'viewer'];
  }
}

export async function normalizeAndValidateRoleGroupIds(groupIds: string[]): Promise<string[]> {
  const normalizedGroupIds = [
    ...new Set(groupIds.map((groupId) => groupId.trim()).filter(Boolean)),
  ];

  if (normalizedGroupIds.length === 0) {
    return [];
  }

  const existingGroups = await db
    .select({ id: whitelistGroups.id })
    .from(whitelistGroups)
    .where(inArray(whitelistGroups.id, normalizedGroupIds));
  const existingIds = new Set(existingGroups.map((group) => group.id));
  const missingIds = normalizedGroupIds.filter((groupId) => !existingIds.has(groupId));

  if (missingIds.length > 0) {
    throw new Error(`Unknown group IDs: ${missingIds.join(', ')}`);
  }

  return normalizedGroupIds;
}
