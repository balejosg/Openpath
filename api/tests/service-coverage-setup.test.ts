import { describe, test } from 'node:test';
import assert from 'node:assert';

import * as setupService from '../src/services/setup.service.js';
import * as userStorage from '../src/lib/user-storage.js';
import {
  DEFAULT_PASSWORD,
  expectOk,
  registerServiceCoverageLifecycle,
  type ServiceResult,
  type TestUser,
  uniqueEmail,
} from './service-coverage-test-support.js';

registerServiceCoverageLifecycle();

void describe('Coverage-oriented service tests - setupService', { concurrency: false }, () => {
  void test('validates first-admin input before setup completes', async () => {
    const duplicateEmail = uniqueEmail('setup-duplicate');
    await userStorage.createUser({
      email: duplicateEmail,
      name: 'Existing User',
      password: DEFAULT_PASSWORD,
    });

    const invalidEmail = await setupService.createFirstAdmin({
      email: 'invalid-email',
      name: 'Setup Admin',
      password: DEFAULT_PASSWORD,
    });
    assert.deepStrictEqual(invalidEmail, {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid email address', field: 'email' },
    });

    const blankName = await setupService.createFirstAdmin({
      email: uniqueEmail('setup-blank-name'),
      name: '   ',
      password: DEFAULT_PASSWORD,
    });
    assert.deepStrictEqual(blankName, {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Name is required', field: 'name' },
    });

    const shortPassword = await setupService.createFirstAdmin({
      email: uniqueEmail('setup-short-password'),
      name: 'Setup Admin',
      password: 'short',
    });
    assert.deepStrictEqual(shortPassword, {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Password must be at least 8 characters',
        field: 'password',
      },
    });

    const duplicateEmailResult = await setupService.createFirstAdmin({
      email: duplicateEmail,
      name: 'Setup Admin',
      password: DEFAULT_PASSWORD,
    });
    assert.deepStrictEqual(duplicateEmailResult, {
      ok: false,
      error: { code: 'EMAIL_EXISTS', message: 'Email already registered' },
    });

    assert.deepStrictEqual(await setupService.validateToken('   '), { valid: false });

    const tokenBeforeSetup = await setupService.getRegistrationToken();
    assert.deepStrictEqual(tokenBeforeSetup, {
      ok: false,
      error: { code: 'SETUP_NOT_COMPLETED', message: 'Setup not completed' },
    });

    const regenerateBeforeSetup = await setupService.regenerateToken();
    assert.deepStrictEqual(regenerateBeforeSetup, {
      ok: false,
      error: { code: 'SETUP_NOT_COMPLETED', message: 'Setup not completed' },
    });
  });

  void test('completes the setup lifecycle and rotates registration tokens', async () => {
    const beforeStatus = await setupService.getStatus();
    assert.deepStrictEqual(beforeStatus, { needsSetup: true, hasAdmin: false });

    const created = (await setupService.createFirstAdmin({
      email: uniqueEmail('setup-admin'),
      name: 'First Admin',
      password: DEFAULT_PASSWORD,
    })) as ServiceResult<{ registrationToken: string; user: TestUser }>;
    const createdData = expectOk(created, 'Expected setup to succeed');

    const storedAdmin = (await userStorage.getUserByEmail(
      createdData.user.email
    )) as TestUser | null;
    assert.ok(storedAdmin);
    assert.strictEqual(storedAdmin.emailVerified, true);

    const afterStatus = await setupService.getStatus();
    assert.deepStrictEqual(afterStatus, { needsSetup: false, hasAdmin: true });

    const tokenValidation = await setupService.validateToken(createdData.registrationToken);
    assert.deepStrictEqual(tokenValidation, { valid: true });

    const existingToken = (await setupService.getRegistrationToken()) as ServiceResult<{
      registrationToken: string;
    }>;
    const existingTokenData = expectOk(existingToken, 'Expected registration token to exist');
    assert.strictEqual(existingTokenData.registrationToken, createdData.registrationToken);

    const rotatedToken = (await setupService.regenerateToken()) as ServiceResult<{
      registrationToken: string;
    }>;
    const rotatedTokenData = expectOk(rotatedToken, 'Expected token regeneration to succeed');
    assert.notStrictEqual(rotatedTokenData.registrationToken, createdData.registrationToken);

    const secondAdmin = await setupService.createFirstAdmin({
      email: uniqueEmail('setup-second-admin'),
      name: 'Second Admin',
      password: DEFAULT_PASSWORD,
    });
    assert.deepStrictEqual(secondAdmin, {
      ok: false,
      error: { code: 'SETUP_ALREADY_COMPLETED', message: 'Setup already completed' },
    });
  });
});
