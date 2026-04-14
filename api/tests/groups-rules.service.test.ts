import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  bulkDeleteRules,
  createRule,
  deleteRule,
  getRulesByIds,
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
});
