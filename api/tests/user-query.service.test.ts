import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as userQueryService from '../src/services/user-query.service.js';

void test('user-query service exports expected read entrypoints', () => {
  assert.equal(typeof userQueryService.listUsers, 'function');
  assert.equal(typeof userQueryService.getUser, 'function');
  assert.equal(typeof userQueryService.listTeachers, 'function');
});
