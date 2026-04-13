import { describe, test } from 'node:test';
import assert from 'node:assert';

import * as userStorage from '../src/lib/user-storage.js';
import * as userService from '../src/services/user.service.js';
import { CANONICAL_GROUP_IDS } from './fixtures.js';
import {
  DEFAULT_PASSWORD,
  expectOk,
  registerServiceCoverageLifecycle,
  type ServiceResult,
  type TestRole,
  type TestUser,
  uniqueEmail,
} from './service-coverage-test-support.js';

registerServiceCoverageLifecycle();

void describe('Coverage-oriented service tests - userService', { concurrency: false }, () => {
  void test('manages users and roles through the service layer', async () => {
    const registered = (await userService.register({
      email: uniqueEmail('service-register'),
      name: 'Service User',
      password: DEFAULT_PASSWORD,
    })) as ServiceResult<{ user: TestUser }>;
    const registeredData = expectOk(registered, 'Expected userService.register to succeed');

    const userId = registeredData.user.id;

    const assigned = (await userService.assignRole(userId, 'teacher', [
      CANONICAL_GROUP_IDS.groupA,
    ])) as ServiceResult<{ id: string }>;
    const assignedData = expectOk(assigned, 'Expected role assignment to succeed');

    const listed = (await userService.listUsers()) as (TestUser & { roles: TestRole[] })[];
    const listedUser = listed.find((user) => user.id === userId);
    assert.ok(listedUser);
    assert.strictEqual(listedUser.roles[0]?.role, 'teacher');

    const fetched = (await userService.getUser(userId)) as ServiceResult<TestUser>;
    const fetchedData = expectOk(fetched, 'Expected getUser to succeed');
    assert.strictEqual(fetchedData.emailVerified, true);

    const updated = (await userService.updateUser(userId, {
      name: 'Updated Service User',
    })) as ServiceResult<TestUser>;
    const updatedData = expectOk(updated, 'Expected updateUser to succeed');
    assert.strictEqual(updatedData.name, 'Updated Service User');

    const revoked = await userService.revokeRole(assignedData.id);
    assert.deepStrictEqual(revoked, { ok: true, data: { success: true } });

    const deleted = await userService.deleteUser(userId);
    assert.deepStrictEqual(deleted, { ok: true, data: { success: true } });
  });

  void test('returns not-found and bad-request errors when appropriate', async () => {
    assert.deepStrictEqual(await userService.getUser('missing-user-id'), {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
    assert.deepStrictEqual(await userService.updateUser('missing-user-id', { name: 'Missing' }), {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
    assert.deepStrictEqual(await userService.deleteUser('missing-user-id'), {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
    assert.deepStrictEqual(await userService.assignRole('missing-user-id', 'teacher', []), {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
    assert.deepStrictEqual(await userService.revokeRole('missing-role-id'), {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Role not found' },
    });

    const firstEmail = uniqueEmail('service-existing');
    const secondEmail = uniqueEmail('service-second');
    const firstUser = (await userStorage.createUser({
      email: firstEmail,
      name: 'First User',
      password: DEFAULT_PASSWORD,
    })) as TestUser;
    const secondUser = (await userStorage.createUser({
      email: secondEmail,
      name: 'Second User',
      password: DEFAULT_PASSWORD,
    })) as TestUser;

    const duplicateUpdate = await userService.updateUser(secondUser.id, {
      email: firstUser.email,
    });
    if (duplicateUpdate.ok) {
      throw new Error('Expected duplicate update to fail');
    }
    assert.strictEqual(duplicateUpdate.error.code, 'BAD_REQUEST');

    const duplicateRegister = await userService.register({
      email: firstUser.email,
      name: 'Duplicate User',
      password: DEFAULT_PASSWORD,
    });
    if (duplicateRegister.ok) {
      throw new Error('Expected duplicate register to fail');
    }
    assert.strictEqual(duplicateRegister.error.code, 'BAD_REQUEST');
  });
});
