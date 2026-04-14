import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as userManagementService from '../src/services/user-management.service.js';

test('user-management service exports expected write entrypoints', () => {
  assert.equal(typeof userManagementService.createManagedUser, 'function');
  assert.equal(typeof userManagementService.assignRole, 'function');
  assert.equal(typeof userManagementService.ensureTeacherRoleGroupAccess, 'function');
});
