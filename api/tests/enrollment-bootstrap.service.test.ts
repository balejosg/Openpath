import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as enrollmentBootstrapService from '../src/services/enrollment-bootstrap.service.js';

void test('enrollment-bootstrap service exports expected bootstrap entrypoints', () => {
  assert.equal(typeof enrollmentBootstrapService.buildLinuxEnrollmentBootstrap, 'function');
  assert.equal(typeof enrollmentBootstrapService.buildWindowsEnrollmentBootstrap, 'function');
});
