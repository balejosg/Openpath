import { describe, test } from 'node:test';
import assert from 'node:assert';

import * as userStorage from '../src/lib/user-storage.js';
import {
  DEFAULT_PASSWORD,
  registerServiceCoverageLifecycle,
  type TestUser,
  uniqueEmail,
} from './service-coverage-test-support.js';

registerServiceCoverageLifecycle();

void describe('Coverage-oriented service tests - userStorage', { concurrency: false }, () => {
  void test('loads the storage types module at runtime', async () => {
    const storageTypesModule = await import('../src/types/storage.js');
    assert.strictEqual(typeof storageTypesModule, 'object');
  });

  void test('covers lookup helpers, Google linking, verification, and stats', async () => {
    const primaryEmail = uniqueEmail('storage-primary');
    const googleEmail = uniqueEmail('storage-google');
    const primary = (await userStorage.createUser({
      email: primaryEmail,
      name: 'Primary User',
      password: DEFAULT_PASSWORD,
    })) as TestUser;
    const googleUser = (await userStorage.createGoogleUser({
      email: googleEmail,
      name: 'Google User',
      googleId: 'google-sub-created',
    })) as TestUser;

    const allUsers = (await userStorage.getAllUsers()) as TestUser[];
    assert.ok(allUsers.some((user) => user.id === primary.id));
    assert.ok(allUsers.some((user) => user.id === googleUser.id));

    assert.strictEqual(await userStorage.linkGoogleId(primary.id, 'google-sub-linked'), true);
    const linkedUser = (await userStorage.getUserByGoogleId(
      'google-sub-linked'
    )) as TestUser | null;
    assert.ok(linkedUser);
    assert.strictEqual(linkedUser.id, primary.id);

    assert.strictEqual(await userStorage.verifyEmail(primary.id), true);
    assert.strictEqual(await userStorage.verifyEmail('missing-user-id'), false);
    assert.strictEqual(await userStorage.deleteUser('missing-user-id'), false);

    await userStorage.updateLastLogin(primary.id);

    const stats = (await userStorage.getStats()) as {
      total: number;
      active: number;
      verified: number;
    };
    assert.strictEqual(stats.total, 3);
    assert.strictEqual(stats.active, 3);
    assert.strictEqual(stats.verified, 2);

    assert.strictEqual(await userStorage.getUserById('missing-user-id'), null);
  });

  void test('covers update, password verification, and delete flows', async () => {
    const email = uniqueEmail('storage-update');
    const created = (await userStorage.createUser({
      email,
      name: '  Before Update  ',
      password: DEFAULT_PASSWORD,
    })) as TestUser;

    const unchanged = (await userStorage.updateUser(created.id, {})) as TestUser | null;
    assert.ok(unchanged);
    assert.strictEqual(unchanged.email, email);

    const updatedEmail = `  ${uniqueEmail('storage-updated').toUpperCase()}  `;
    const updated = (await userStorage.updateUser(created.id, {
      email: updatedEmail,
      name: '  Updated User  ',
      password: 'NewPassword123!',
    })) as TestUser | null;

    assert.ok(updated);
    assert.strictEqual(updated.email, updatedEmail.toLowerCase().trim());
    assert.strictEqual(updated.name, 'Updated User');

    const fullUser = (await userStorage.getUserByEmail(updated.email)) as TestUser | null;
    assert.ok(fullUser);
    assert.strictEqual(await userStorage.verifyPassword(fullUser, 'NewPassword123!'), true);
    assert.strictEqual(await userStorage.verifyPassword(fullUser, 'WrongPassword123!'), false);
    assert.strictEqual(
      await userStorage.verifyPasswordByEmail(updated.email, 'WrongPassword123!'),
      null
    );

    const verifiedByEmail = (await userStorage.verifyPasswordByEmail(
      updated.email,
      'NewPassword123!'
    )) as TestUser | null;
    assert.ok(verifiedByEmail);
    assert.strictEqual(verifiedByEmail.email, updated.email);

    assert.strictEqual(await userStorage.deleteUser(created.id), true);
    assert.strictEqual(await userStorage.getUserById(created.id), null);
  });
});
