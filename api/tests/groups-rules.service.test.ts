import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  bulkDeleteRules,
  createRule,
  deleteRule,
  getRulesByIds,
  revokeAutoApproval,
} from '../src/services/groups-rules.service.js';

async function runWithFakeTx<T>(callback: (tx: never) => Promise<T>): Promise<T> {
  return callback({} as never);
}

await describe('groups rules service', async () => {
  await test('returns empty rules immediately for empty ids', async () => {
    assert.deepEqual(await getRulesByIds([]), []);
  });

  await test('rejects invalid rule values before touching storage', async () => {
    const result = await createRule(
      {
        groupId: 'group-1',
        type: 'whitelist',
        value: 'http://',
      },
      {
        bulkDeleteRules: () => Promise.resolve(0),
        createRule: () => Promise.resolve({ success: false }),
        deleteRule: () => Promise.resolve(false),
        getGroupById: () => Promise.resolve(null),
        getRuleById: () => Promise.resolve(null),
        getRulesByIds: () => Promise.resolve([]),
        publishWhitelistChanged: (_groupId) => undefined,
        withTransaction: runWithFakeTx,
      }
    );

    assert.deepEqual(result, {
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Value is required' },
    });
  });

  await test('publishes affected groups on bulk delete', async () => {
    const publishedGroups: string[] = [];

    const result = await bulkDeleteRules(
      ['rule-1', 'rule-2'],
      {
        rules: [
          {
            id: 'rule-1',
            groupId: 'group-a',
            type: 'whitelist',
            value: 'a.example.com',
            source: 'manual',
            comment: null,
            createdAt: '',
          },
          {
            id: 'rule-2',
            groupId: 'group-b',
            type: 'whitelist',
            value: 'b.example.com',
            source: 'manual',
            comment: null,
            createdAt: '',
          },
        ],
      },
      {
        bulkDeleteRules: () => Promise.resolve(2),
        getRulesByIds: () => Promise.resolve([]),
        publishWhitelistChanged: (groupId: string) => {
          publishedGroups.push(groupId);
        },
        withTransaction: runWithFakeTx,
      }
    );

    assert.deepEqual(result, {
      ok: true,
      data: {
        deleted: 2,
        rules: [
          {
            id: 'rule-1',
            groupId: 'group-a',
            type: 'whitelist',
            value: 'a.example.com',
            source: 'manual',
            comment: null,
            createdAt: '',
          },
          {
            id: 'rule-2',
            groupId: 'group-b',
            type: 'whitelist',
            value: 'b.example.com',
            source: 'manual',
            comment: null,
            createdAt: '',
          },
        ],
      },
    });
    assert.deepEqual(publishedGroups.sort(), ['group-a', 'group-b']);
  });

  await test('reuses looked-up rule group when deleting a single rule', async () => {
    const publishedGroups: string[] = [];

    const result = await deleteRule('rule-1', undefined, {
      deleteRule: () => Promise.resolve(true),
      getRuleById: () =>
        Promise.resolve({
          id: 'rule-1',
          groupId: 'group-a',
          type: 'whitelist' as const,
          value: 'a.example.com',
          source: 'manual' as const,
          comment: null,
          createdAt: '',
        }),
      publishWhitelistChanged: (groupId: string) => {
        publishedGroups.push(groupId);
      },
      withTransaction: runWithFakeTx,
    });

    assert.deepEqual(result, {
      ok: true,
      data: { deleted: true },
    });
    assert.deepEqual(publishedGroups, ['group-a']);
  });

  await test('revokes an automatic approval by replacing it with an explicit block', async () => {
    const publishedGroups: string[] = [];
    const deletedRuleIds: string[] = [];
    const createdRules: {
      groupId: string;
      type: string;
      value: string;
      comment: string | null | undefined;
      source: string | undefined;
    }[] = [];

    const result = await revokeAutoApproval(
      { id: 'rule-auto-1', groupId: 'group-a', resolvedBy: 'teacher@example.com' },
      {
        bulkDeleteRules: () => Promise.resolve(0),
        createRule: (groupId, type, value, comment, source) => {
          createdRules.push({ groupId, type, value, comment, source });
          return Promise.resolve({ success: true, id: 'blocked-rule-1' });
        },
        deleteRule: (id) => {
          deletedRuleIds.push(id);
          return Promise.resolve(true);
        },
        getGroupById: () => Promise.resolve(null),
        getRuleById: () =>
          Promise.resolve({
            id: 'rule-auto-1',
            groupId: 'group-a',
            type: 'whitelist',
            value: 'cdn.example.com',
            source: 'auto_extension',
            comment: null,
            createdAt: '',
          }),
        getRulesByIds: () => Promise.resolve([]),
        publishWhitelistChanged: (groupId: string) => {
          publishedGroups.push(groupId);
        },
        withTransaction: runWithFakeTx,
      }
    );

    assert.deepEqual(result, {
      ok: true,
      data: { revoked: true, blockedRuleId: 'blocked-rule-1' },
    });
    assert.deepEqual(deletedRuleIds, ['rule-auto-1']);
    assert.deepEqual(createdRules, [
      {
        groupId: 'group-a',
        type: 'blocked_subdomain',
        value: 'cdn.example.com',
        comment: 'Revoked automatic approval by teacher@example.com',
        source: 'manual',
      },
    ]);
    assert.deepEqual(publishedGroups, ['group-a']);
  });

  await test('does not revoke manual whitelist rules as automatic approvals', async () => {
    const result = await revokeAutoApproval(
      { id: 'rule-manual-1', groupId: 'group-a', resolvedBy: 'teacher@example.com' },
      {
        bulkDeleteRules: () => Promise.resolve(0),
        createRule: () => Promise.resolve({ success: true, id: 'blocked-rule-1' }),
        deleteRule: () => Promise.resolve(true),
        getGroupById: () => Promise.resolve(null),
        getRuleById: () =>
          Promise.resolve({
            id: 'rule-manual-1',
            groupId: 'group-a',
            type: 'whitelist',
            value: 'cdn.example.com',
            source: 'manual',
            comment: null,
            createdAt: '',
          }),
        getRulesByIds: () => Promise.resolve([]),
        publishWhitelistChanged: () => undefined,
        withTransaction: runWithFakeTx,
      }
    );

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Only automatic whitelist approvals can be revoked this way',
      },
    });
  });
});
