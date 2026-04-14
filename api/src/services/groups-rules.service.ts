import * as groupsStorage from '../lib/groups-storage.js';
import { withTransaction } from '../db/index.js';
import type {
  PaginatedGroupedRulesResult,
  PaginatedRulesResult,
  ListRulesOptions,
  ListRulesGroupedOptions,
  Rule,
  RuleType,
} from '../lib/groups-storage.js';
import { validateRuleValue, cleanRuleValue } from '@openpath/shared';
import DomainEventsService from './domain-events.service.js';
import type {
  BulkCreateRulesInput,
  CreateRuleInput,
  GroupsResult,
  UpdateRuleInput,
} from './groups-service-shared.js';

interface GroupsRulesDependencies {
  bulkDeleteRules: typeof groupsStorage.bulkDeleteRules;
  createRule: typeof groupsStorage.createRule;
  deleteRule: typeof groupsStorage.deleteRule;
  getGroupById: typeof groupsStorage.getGroupById;
  getRuleById: typeof groupsStorage.getRuleById;
  getRulesByIds: typeof groupsStorage.getRulesByIds;
  publishWhitelistChanged: (groupId: string) => void;
  withTransaction: typeof withTransaction;
}

const defaultRulesDependencies: GroupsRulesDependencies = {
  bulkDeleteRules: groupsStorage.bulkDeleteRules,
  createRule: groupsStorage.createRule,
  deleteRule: groupsStorage.deleteRule,
  getGroupById: groupsStorage.getGroupById,
  getRuleById: groupsStorage.getRuleById,
  getRulesByIds: groupsStorage.getRulesByIds,
  publishWhitelistChanged: DomainEventsService.publishWhitelistChanged.bind(DomainEventsService),
  withTransaction,
};

async function ensureGroupExists(
  groupId: string,
  deps: Pick<GroupsRulesDependencies, 'getGroupById'> = defaultRulesDependencies
): Promise<GroupsResult<void>> {
  const group = await deps.getGroupById(groupId);
  if (!group) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Group not found' } };
  }

  return { ok: true, data: undefined };
}

export async function listRules(groupId: string, type?: RuleType): Promise<GroupsResult<Rule[]>> {
  const group = await ensureGroupExists(groupId);
  if (!group.ok) {
    return group;
  }

  const rules = await groupsStorage.getRulesByGroup(groupId, type);
  return { ok: true, data: rules };
}

export async function listRulesPaginated(
  options: ListRulesOptions
): Promise<GroupsResult<PaginatedRulesResult>> {
  const group = await ensureGroupExists(options.groupId);
  if (!group.ok) {
    return group;
  }

  const result = await groupsStorage.getRulesByGroupPaginated(options);
  return { ok: true, data: result };
}

export async function listRulesGrouped(
  options: ListRulesGroupedOptions
): Promise<GroupsResult<PaginatedGroupedRulesResult>> {
  const group = await ensureGroupExists(options.groupId);
  if (!group.ok) {
    return group;
  }

  const result = await groupsStorage.getRulesByGroupGrouped(options);
  return { ok: true, data: result };
}

export async function getRuleById(id: string): Promise<Rule | null> {
  return groupsStorage.getRuleById(id);
}

export async function getRulesByIds(ids: string[]): Promise<Rule[]> {
  if (ids.length === 0) {
    return [];
  }

  return groupsStorage.getRulesByIds(ids);
}

export async function createRule(
  input: CreateRuleInput,
  deps: GroupsRulesDependencies = defaultRulesDependencies
): Promise<GroupsResult<{ id: string }>> {
  const cleanedValue = cleanRuleValue(input.value, input.type === 'blocked_path');
  if (!cleanedValue) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'Value is required' } };
  }

  const validation = validateRuleValue(cleanedValue, input.type);
  if (!validation.valid) {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: validation.error ?? 'Invalid rule value format' },
    };
  }

  const group = await ensureGroupExists(input.groupId, deps);
  if (!group.ok) {
    return group;
  }

  const result = await deps.withTransaction(async (tx) =>
    deps.createRule(input.groupId, input.type, cleanedValue, input.comment ?? null, 'manual', tx)
  );

  if (!result.success) {
    return {
      ok: false,
      error: { code: 'CONFLICT', message: result.error ?? 'Rule already exists' },
    };
  }

  if (!result.id) {
    return {
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create rule' },
    };
  }

  deps.publishWhitelistChanged(input.groupId);
  return { ok: true, data: { id: result.id } };
}

export async function deleteRule(
  id: string,
  groupId?: string,
  deps: Pick<
    GroupsRulesDependencies,
    'deleteRule' | 'getRuleById' | 'publishWhitelistChanged' | 'withTransaction'
  > = defaultRulesDependencies
): Promise<GroupsResult<{ deleted: boolean }>> {
  let ruleGroupId = groupId;
  if (!ruleGroupId) {
    const rule = await deps.getRuleById(id);
    ruleGroupId = rule?.groupId;
  }

  const deleted = await deps.withTransaction(async (tx) => deps.deleteRule(id, tx));

  if (deleted && ruleGroupId) {
    deps.publishWhitelistChanged(ruleGroupId);
  }

  return { ok: true, data: { deleted } };
}

export async function bulkDeleteRules(
  ids: string[],
  options?: { rules?: Rule[] },
  deps: Pick<
    GroupsRulesDependencies,
    'bulkDeleteRules' | 'getRulesByIds' | 'publishWhitelistChanged' | 'withTransaction'
  > = defaultRulesDependencies
): Promise<GroupsResult<{ deleted: number; rules: Rule[] }>> {
  if (ids.length === 0) {
    return { ok: true, data: { deleted: 0, rules: [] } };
  }

  const rules = options?.rules ?? (await deps.getRulesByIds(ids));
  const deleted = await deps.withTransaction(async (tx) => deps.bulkDeleteRules(ids, tx));

  if (deleted > 0) {
    const affectedGroups = new Set(rules.map((rule) => rule.groupId));
    for (const groupId of affectedGroups) {
      deps.publishWhitelistChanged(groupId);
    }
  }

  return { ok: true, data: { deleted, rules } };
}

export async function updateRule(input: UpdateRuleInput): Promise<GroupsResult<Rule>> {
  const group = await ensureGroupExists(input.groupId);
  if (!group.ok) {
    return group;
  }

  const existingRule = await groupsStorage.getRuleById(input.id);
  if (!existingRule) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } };
  }

  if (existingRule.groupId !== input.groupId) {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Rule does not belong to this group' },
    };
  }

  let cleanedValue = input.value;
  const didChangeExport =
    cleanedValue !== undefined &&
    cleanRuleValue(cleanedValue, existingRule.type === 'blocked_path') !== existingRule.value;

  if (cleanedValue !== undefined) {
    cleanedValue = cleanRuleValue(cleanedValue, existingRule.type === 'blocked_path');
    if (!cleanedValue) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'Value cannot be empty' } };
    }

    const validation = validateRuleValue(cleanedValue, existingRule.type);
    if (!validation.valid) {
      return {
        ok: false,
        error: { code: 'BAD_REQUEST', message: validation.error ?? 'Invalid rule value format' },
      };
    }
  }

  const updated = await withTransaction(async (tx) =>
    groupsStorage.updateRule(
      {
        id: input.id,
        value: cleanedValue,
        comment: input.comment,
      },
      tx
    )
  );

  if (!updated) {
    return {
      ok: false,
      error: { code: 'CONFLICT', message: 'A rule with this value already exists' },
    };
  }

  if (didChangeExport) {
    DomainEventsService.publishWhitelistChanged(input.groupId);
  }

  return { ok: true, data: updated };
}

export async function bulkCreateRules(
  input: BulkCreateRulesInput
): Promise<GroupsResult<{ count: number }>> {
  const group = await ensureGroupExists(input.groupId);
  if (!group.ok) {
    return group;
  }

  const preservePath = input.type === 'blocked_path';
  const cleanedValues = input.values.map((value) => cleanRuleValue(value, preservePath));

  const count = await withTransaction(async (tx) =>
    groupsStorage.bulkCreateRules(input.groupId, input.type, cleanedValues, 'manual', tx)
  );

  if (count > 0) {
    DomainEventsService.publishWhitelistChanged(input.groupId);
  }

  return { ok: true, data: { count } };
}

export const GroupsRulesService = {
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
};

export default GroupsRulesService;
