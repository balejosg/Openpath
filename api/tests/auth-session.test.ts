import { describe, test } from 'node:test';
import assert from 'node:assert';

import {
  type AuthResult,
  createLegacyAdminAccessToken,
  createVerifiedUser,
  loadTestConfigWithoutJwtSecret,
  parseTRPC,
  registerAuthHttpLifecycle,
  trpcMutate,
  trpcQuery,
  uniqueAuthEmail,
} from './auth-test-harness.js';

registerAuthHttpLifecycle();

void describe('Authentication API tests - sessions and identity', async () => {
  await describe('tRPC auth.login - User Login', async () => {
    const testPassword = 'SecurePassword123!';
    const testEmail = uniqueAuthEmail('login');

    await test('setup login user', async () => {
      await createVerifiedUser({
        email: testEmail,
        name: 'Login Test User',
        password: testPassword,
      });
    });

    await test('should login with valid credentials', async () => {
      const response = await trpcMutate('auth.login', {
        email: testEmail,
        password: testPassword,
      });

      assert.strictEqual(response.status, 200);
      const { data } = (await parseTRPC(response)) as { data?: AuthResult };
      assert.ok(data);
      assert.ok(data.accessToken);
      assert.ok(data.refreshToken);
      assert.strictEqual(typeof data.expiresIn, 'number');
      assert.ok((data.expiresIn ?? 0) > 0);
      assert.strictEqual(data.sessionTransport, 'token');
      assert.ok(data.user);
    });

    await test('should reject login with wrong password', async () => {
      const response = await trpcMutate('auth.login', {
        email: testEmail,
        password: 'WrongPassword123!',
      });

      assert.strictEqual(response.status, 401);
    });

    await test('should reject login with non-existent email', async () => {
      const response = await trpcMutate('auth.login', {
        email: uniqueAuthEmail('missing-login'),
        password: 'SomePassword123!',
      });

      assert.strictEqual(response.status, 401);
    });
  });

  await describe('tRPC auth.refresh - Token Refresh', async () => {
    const email = uniqueAuthEmail('refresh');
    const password = 'SecurePassword123!';

    await test('should refresh tokens with valid refresh token', async () => {
      await createVerifiedUser({
        email,
        name: 'Refresh Test User',
        password,
      });

      const loginResponse = await trpcMutate('auth.login', {
        email,
        password,
      });
      assert.strictEqual(loginResponse.status, 200);

      const { data } = (await parseTRPC(loginResponse)) as { data?: AuthResult };
      assert.ok(data?.refreshToken);

      const response = await trpcMutate('auth.refresh', {
        refreshToken: data.refreshToken,
      });
      assert.strictEqual(response.status, 200);

      const refreshData = (await parseTRPC(response)) as { data?: AuthResult };
      assert.ok(refreshData.data);
      assert.ok(refreshData.data.accessToken);
      assert.ok(refreshData.data.refreshToken);
    });

    await test('should reject invalid refresh token', async () => {
      const response = await trpcMutate('auth.refresh', { refreshToken: 'invalid-token' });
      assert.strictEqual(response.status, 401);
    });
  });

  await describe('tRPC auth.me - Get Current User', async () => {
    await test('should reject request without token', async () => {
      const response = await trpcQuery('auth.me');
      assert.strictEqual(response.status, 401);
    });

    await test('should use the deterministic test JWT secret fallback when unset', () => {
      assert.strictEqual(loadTestConfigWithoutJwtSecret(), 'openpath-test-secret');
    });

    await test('should reject request with invalid token', async () => {
      const response = await trpcQuery('auth.me', undefined, {
        Authorization: 'Bearer invalid-token',
      });
      assert.strictEqual(response.status, 401);
    });

    await test('should allow admin routes with a bearer JWT', async () => {
      const response = await trpcQuery('users.list', undefined, {
        Authorization: `Bearer ${createLegacyAdminAccessToken()}`,
      });

      assert.strictEqual(response.status, 200);
    });

    await test('should allow admin routes with a cookie-backed access token', async () => {
      const accessToken = createLegacyAdminAccessToken();
      const previousCookieName = process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME;
      process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = 'op_access';

      try {
        const response = await trpcQuery('users.list', undefined, {
          Cookie: `op_access=${encodeURIComponent(accessToken)}`,
        });

        assert.strictEqual(response.status, 200);
      } finally {
        if (previousCookieName === undefined) {
          Reflect.deleteProperty(process.env, 'OPENPATH_ACCESS_TOKEN_COOKIE_NAME');
        } else {
          process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = previousCookieName;
        }
      }
    });
  });

  await describe('tRPC auth.logout - Logout', async () => {
    await test('should logout successfully', async () => {
      const created = await createVerifiedUser({
        email: uniqueAuthEmail('logout'),
        name: 'Logout User',
      });
      const loginResponse = await trpcMutate('auth.login', created);
      assert.strictEqual(loginResponse.status, 200);

      const { data } = (await parseTRPC(loginResponse)) as { data?: AuthResult };
      assert.ok(data?.accessToken);

      const response = await trpcMutate(
        'auth.logout',
        {},
        { Authorization: `Bearer ${data.accessToken}` }
      );
      assert.strictEqual(response.status, 200);
    });
  });
});
