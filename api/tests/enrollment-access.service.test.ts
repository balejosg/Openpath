import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as enrollmentAccessService from '../src/services/enrollment-access.service.js';

test('enrollment-access service exports expected access entrypoints', () => {
  assert.equal(typeof enrollmentAccessService.resolveEnrollmentContext, 'function');
  assert.equal(typeof enrollmentAccessService.resolveEnrollmentTokenAccess, 'function');
  assert.equal(typeof enrollmentAccessService.issueEnrollmentTicket, 'function');
});
