import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapDBRoleToRole } from '../src/services/user-service-shared.js';

test('user-service-shared maps database roles to public roles', () => {
  const role = mapDBRoleToRole({
    id: 'role-1',
    userId: 'user-1',
    role: 'teacher',
    groupIds: ['group-a'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: null,
    createdBy: null,
    expiresAt: null,
  });

  assert.equal(role.role, 'teacher');
  assert.deepEqual(role.groupIds, ['group-a']);
});
