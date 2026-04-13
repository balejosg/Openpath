import { describe, test } from 'node:test';
import assert from 'node:assert';

import {
  createUserAccessToken,
  createVerifiedUser,
  registerAuthHttpLifecycle,
  trpcMutate,
  uniqueAuthEmail,
} from './auth-test-harness.js';

registerAuthHttpLifecycle();

void describe('Authentication API tests - password management', async () => {
  await describe('tRPC auth.changePassword - Change Password', async () => {
    const testEmail = uniqueAuthEmail('change-password');
    const currentPassword = 'CurrentPassword123!';
    const newPassword = 'NewPassword456!';

    await test('setup password-change user', async () => {
      await createVerifiedUser({
        email: testEmail,
        name: 'Change Password User',
        password: currentPassword,
      });
    });

    await test('should require authentication', async () => {
      const response = await trpcMutate('auth.changePassword', {
        currentPassword,
        newPassword,
      });

      assert.strictEqual(response.status, 401);
    });

    await test('should reject wrong current password', async () => {
      const accessToken = await createUserAccessToken({ email: testEmail });
      const response = await trpcMutate(
        'auth.changePassword',
        {
          currentPassword: 'WrongCurrentPassword123!',
          newPassword,
        },
        { Authorization: `Bearer ${accessToken}` }
      );

      assert.strictEqual(response.status, 400);
    });

    await test('should change password and invalidate old credentials', async () => {
      const accessToken = await createUserAccessToken({ email: testEmail });
      const changeResponse = await trpcMutate(
        'auth.changePassword',
        {
          currentPassword,
          newPassword,
        },
        { Authorization: `Bearer ${accessToken}` }
      );

      assert.strictEqual(changeResponse.status, 200);

      const oldLoginResponse = await trpcMutate('auth.login', {
        email: testEmail,
        password: currentPassword,
      });
      assert.ok([401, 429].includes(oldLoginResponse.status));

      const newLoginResponse = await trpcMutate('auth.login', {
        email: testEmail,
        password: newPassword,
      });
      assert.strictEqual(newLoginResponse.status, 200);
    });
  });
});
