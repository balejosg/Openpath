import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as authSessionService from '../src/services/auth-session.service.js';

test('auth-session service exports expected session entrypoints', () => {
  assert.equal(typeof authSessionService.register, 'function');
  assert.equal(typeof authSessionService.login, 'function');
  assert.equal(typeof authSessionService.refresh, 'function');
  assert.equal(typeof authSessionService.logout, 'function');
});
