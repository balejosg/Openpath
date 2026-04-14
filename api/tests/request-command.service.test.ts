import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as requestCommandService from '../src/services/request-command.service.js';

void test('request-command service exports expected mutation entrypoints', () => {
  assert.equal(typeof requestCommandService.createRequest, 'function');
  assert.equal(typeof requestCommandService.approveRequest, 'function');
  assert.equal(typeof requestCommandService.deleteRequest, 'function');
});
