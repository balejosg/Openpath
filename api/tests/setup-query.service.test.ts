import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as setupQueryService from '../src/services/setup-query.service.js';

test('setup-query service exports expected read entrypoints', () => {
  assert.equal(typeof setupQueryService.getStatus, 'function');
  assert.equal(typeof setupQueryService.validateToken, 'function');
  assert.equal(typeof setupQueryService.getRegistrationToken, 'function');
});
