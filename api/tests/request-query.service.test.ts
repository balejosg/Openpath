import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as requestQueryService from '../src/services/request-query.service.js';

test('request-query service exports expected read entrypoints', () => {
  assert.equal(typeof requestQueryService.getRequestStatus, 'function');
  assert.equal(typeof requestQueryService.listRequests, 'function');
  assert.equal(typeof requestQueryService.checkDomainBlocked, 'function');
});
