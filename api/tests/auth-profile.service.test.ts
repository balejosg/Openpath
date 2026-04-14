import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as authProfileService from '../src/services/auth-profile.service.js';

void test('auth-profile service exports expected profile entrypoints', () => {
  assert.equal(typeof authProfileService.getProfile, 'function');
  assert.equal(typeof authProfileService.changePassword, 'function');
});
