import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as setupManagementService from '../src/services/setup-management.service.js';

void test('setup-management service exports expected mutation entrypoints', () => {
  assert.equal(typeof setupManagementService.createFirstAdmin, 'function');
  assert.equal(typeof setupManagementService.regenerateToken, 'function');
});
