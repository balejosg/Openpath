/**
 * OpenPath - Strict Internet Access Control
 * Copyright (C) 2025 OpenPath Authors
 *
 * GroupsService - Business logic for whitelist groups and rules management
 */

import * as groupsStorage from '../lib/groups-storage.js';
import { withTransaction } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import type { GroupWithCounts, GroupStats, SystemStatus } from '../lib/groups-storage.js';
import { sanitizeSlug } from '@openpath/shared';
import DomainEventsService from './domain-events.service.js';
import {
  canUserAccessGroup,
  canUserViewGroup,
  ensureUserCanAccessGroupId,
  ensureUserCanViewGroupId,
  getGroupById,
  getGroupByName,
  listGroups,
  listGroupsVisibleToUser,
  listLibraryGroups,
} from './groups-access.service.js';
import {
  bulkCreateRules,
  bulkDeleteRules,
  createRule,
  deleteRule,
  getRuleById,
  getRulesByIds,
  listRules,
  listRulesGrouped,
  listRulesPaginated,
  updateRule,
} from './groups-rules.service.js';
import type {
  CloneGroupInput,
  CreateGroupInput,
  ExportResult,
  GroupsResult,
  UpdateGroupInput,
} from './groups-service-shared.js';
export type {
  BulkCreateRulesInput,
  CloneGroupInput,
  CreateGroupInput,
  CreateRuleInput,
  ExportResult,
  GroupsResult,
  GroupsServiceError,
  UpdateGroupInput,
  UpdateRuleInput,
} from './groups-service-shared.js';

// =============================================================================
// Types
// =============================================================================

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create a new group.
 */
export async function createGroup(
  input: CreateGroupInput
): Promise<GroupsResult<{ id: string; name: string }>> {
  // Validate input
  if (!input.name || input.name.trim() === '') {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'Name is required' } };
  }
  if (!input.displayName || input.displayName.trim() === '') {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'Display name is required' } };
  }

  // Sanitize name for URL safety
  const safeName = sanitizeSlug(input.name, { maxLength: 100, allowUnderscore: true });
  if (!safeName) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'Name is invalid' } };
  }

  try {
    const id = await groupsStorage.createGroup(safeName, input.displayName, {
      ...(input.visibility ? { visibility: input.visibility } : {}),
      ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
    });
    return { ok: true, data: { id, name: safeName } };
  } catch (err) {
    if (err instanceof Error && err.message === 'UNIQUE_CONSTRAINT_VIOLATION') {
      return {
        ok: false,
        error: { code: 'CONFLICT', message: 'A group with this name already exists' },
      };
    }
    throw err;
  }
}

/**
 * Update a group.
 */
export async function updateGroup(input: UpdateGroupInput): Promise<GroupsResult<GroupWithCounts>> {
  // Check if group exists
  const existing = await groupsStorage.getGroupById(input.id);
  if (!existing) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Group not found' } };
  }

  await groupsStorage.updateGroup(input.id, input.displayName, input.enabled, input.visibility);

  const updated = await groupsStorage.getGroupById(input.id);
  if (!updated) {
    return {
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch updated group' },
    };
  }

  // Notify SSE clients if enabled state changed
  if (existing.enabled !== input.enabled) {
    DomainEventsService.publishWhitelistChanged(input.id);
  }

  return { ok: true, data: updated };
}

/**
 * Delete a group.
 */
export async function deleteGroup(id: string): Promise<GroupsResult<{ deleted: boolean }>> {
  const existing = await groupsStorage.getGroupById(id);
  if (!existing) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Group not found' } };
  }

  const deleted = await groupsStorage.deleteGroup(id);

  // Notify SSE clients that this group's whitelist is gone
  if (deleted) {
    DomainEventsService.publishWhitelistChanged(id);
  }

  return { ok: true, data: { deleted } };
}

function sanitizeGroupName(raw: string): string {
  return sanitizeSlug(raw, { maxLength: 100, allowUnderscore: true });
}

async function findAvailableGroupName(baseName: string): Promise<string> {
  const trimmedBase = sanitizeGroupName(baseName);
  if (!trimmedBase) {
    return `group-${uuidv4().slice(0, 8)}`;
  }

  const maxAttempts = 50;
  for (let i = 0; i < maxAttempts; i++) {
    const suffix = i === 0 ? '' : `-${String(i + 1)}`;
    const candidate = `${trimmedBase}${suffix}`.slice(0, 100).replace(/-+$/g, '');
    const exists = await groupsStorage.getGroupMetaByName(candidate);
    if (!exists) return candidate;
  }
  return `${trimmedBase}-${uuidv4().slice(0, 8)}`.slice(0, 100).replace(/-+$/g, '');
}

/**
 * Clone an existing group into a new private group (copy rules).
 */
export async function cloneGroup(
  input: CloneGroupInput
): Promise<GroupsResult<{ id: string; name: string }>> {
  const source = await groupsStorage.getGroupById(input.sourceGroupId);
  if (!source) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Group not found' } };
  }

  let baseName = `${source.name}-copy`;
  const trimmedName = input.name?.trim();
  if (trimmedName) {
    baseName = trimmedName;
  }

  const name = await findAvailableGroupName(baseName);

  try {
    const id = await withTransaction(async (tx) => {
      const createdGroupId = await groupsStorage.createGroup(
        name,
        input.displayName,
        {
          visibility: 'private',
          ownerUserId: input.ownerUserId,
        },
        tx
      );

      await groupsStorage.copyRulesToGroup(
        { fromGroupId: source.id, toGroupId: createdGroupId },
        tx
      );

      await groupsStorage.touchGroupUpdatedAt(createdGroupId, tx);
      return createdGroupId;
    });

    DomainEventsService.publishWhitelistChanged(id);

    return { ok: true, data: { id, name } };
  } catch (err) {
    if (err instanceof Error && err.message === 'UNIQUE_CONSTRAINT_VIOLATION') {
      return {
        ok: false,
        error: { code: 'CONFLICT', message: 'A group with this name already exists' },
      };
    }
    throw err;
  }
}

/**
 * List rules for a group.
 */
/**
 * Get group statistics.
 */
export async function getStats(): Promise<GroupStats> {
  return groupsStorage.getStats();
}

/**
 * Get system status.
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  return groupsStorage.getSystemStatus();
}

/**
 * Toggle system status (enable/disable all groups).
 */
export async function toggleSystemStatus(enable: boolean): Promise<SystemStatus> {
  const result = await groupsStorage.toggleSystemStatus(enable);
  DomainEventsService.publishAllWhitelistsChanged();
  return result;
}

/**
 * Export a group to file content.
 */
export async function exportGroup(groupId: string): Promise<GroupsResult<ExportResult>> {
  const group = await groupsStorage.getGroupById(groupId);
  if (!group) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Group not found' } };
  }

  const content = await groupsStorage.exportGroup(groupId);
  if (!content) {
    return {
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to export group' },
    };
  }

  return { ok: true, data: { name: group.name, content } };
}

/**
 * Export all groups.
 */
export async function exportAllGroups(): Promise<ExportResult[]> {
  return groupsStorage.exportAllGroups();
}

// =============================================================================
// Default Export
// =============================================================================

export const GroupsService = {
  listGroups,
  listGroupsVisibleToUser,
  listLibraryGroups,
  canUserAccessGroup,
  canUserViewGroup,
  ensureUserCanAccessGroupId,
  ensureUserCanViewGroupId,
  getGroupById,
  getGroupByName,
  createGroup,
  cloneGroup,
  updateGroup,
  deleteGroup,
  listRules,
  listRulesPaginated,
  listRulesGrouped,
  getRuleById,
  getRulesByIds,
  createRule,
  updateRule,
  deleteRule,
  bulkCreateRules,
  bulkDeleteRules,
  getStats,
  getSystemStatus,
  toggleSystemStatus,
  exportGroup,
  exportAllGroups,
};

export default GroupsService;
