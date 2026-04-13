import { describe, test } from 'node:test';
import assert from 'node:assert';

import { registerAuthHttpLifecycle, trpcMutate, trpcQuery } from './auth-test-harness.js';

registerAuthHttpLifecycle();

void describe('Authentication API tests - admin authorization guards', async () => {
  await describe('tRPC users - Admin User Management Endpoints', async () => {
    await test('users.list should require admin authentication', async () => {
      const response = await trpcQuery('users.list');
      assert.strictEqual(response.status, 401);
    });

    await test('users.create should require admin authentication', async () => {
      const response = await trpcMutate('users.create', {
        email: 'admin-create-test@example.com',
        name: 'Admin Created User',
        password: 'SecurePassword123!',
      });

      assert.strictEqual(response.status, 401);
    });
  });

  await describe('tRPC users - Role Management Endpoints', async () => {
    await test('users.assignRole should require admin authentication', async () => {
      const response = await trpcMutate('users.assignRole', {
        groupIds: ['group1'],
        role: 'teacher',
        userId: 'some-user-id',
      });

      assert.strictEqual(response.status, 401);
    });

    await test('users.listTeachers should require admin authentication', async () => {
      const response = await trpcQuery('users.listTeachers');
      assert.strictEqual(response.status, 401);
    });
  });
});
