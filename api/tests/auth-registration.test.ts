import { describe, test } from 'node:test';
import assert from 'node:assert';

import {
  type AuthResult,
  createLegacyAdminAccessToken,
  parseTRPC,
  registerAuthHttpLifecycle,
  trpcMutate,
  uniqueAuthEmail,
  userStorage,
} from './auth-test-harness.js';

registerAuthHttpLifecycle();

void describe('Authentication API tests - registration and verification', async () => {
  await describe('tRPC auth.register - User Registration', async () => {
    await test('should register a new user', async () => {
      const input = {
        email: uniqueAuthEmail('register'),
        password: 'SecurePassword123!',
        name: 'Test User',
      };

      const response = await trpcMutate('auth.register', input);
      assert.strictEqual(response.status, 200);

      const { data } = (await parseTRPC(response)) as { data?: AuthResult };
      assert.ok(data);
      assert.ok(data.user);
      assert.ok(data.user.id);
      assert.deepStrictEqual(data.user.roles ?? [], []);
      assert.strictEqual(data.verificationRequired, true);
      assert.strictEqual(data.verificationToken, undefined);
      assert.strictEqual(data.verificationExpiresAt, undefined);
    });

    await test('should reject registration without email', async () => {
      const response = await trpcMutate('auth.register', {
        name: 'Test User',
        password: 'SecurePassword123!',
      });

      assert.strictEqual(response.status, 400);
    });

    await test('should reject registration with short password', async () => {
      const response = await trpcMutate('auth.register', {
        email: uniqueAuthEmail('short-password'),
        name: 'Test User',
        password: '123',
      });

      assert.strictEqual(response.status, 400);
    });

    await test('should reject duplicate email registration', async () => {
      const email = uniqueAuthEmail('duplicate');

      await trpcMutate('auth.register', {
        email,
        name: 'First User',
        password: 'SecurePassword123!',
      });

      const response = await trpcMutate('auth.register', {
        email,
        name: 'Second User',
        password: 'DifferentPassword123!',
      });

      assert.ok([409, 429].includes(response.status));
    });
  });

  await describe('tRPC auth.generateEmailVerificationToken - Restricted issuance', async () => {
    const adminAccessToken = createLegacyAdminAccessToken();

    await test('should reject unauthenticated email verification issuance', async () => {
      const email = uniqueAuthEmail('verify-public');
      await userStorage.createUser(
        {
          email,
          name: 'Verification Public User',
          password: 'SecurePassword123!',
        },
        { emailVerified: false }
      );

      const response = await trpcMutate('auth.generateEmailVerificationToken', { email });
      assert.strictEqual(response.status, 401);
    });

    await test('should allow admins to issue a verification token for an unverified user', async () => {
      const email = uniqueAuthEmail('verify-admin');
      await userStorage.createUser(
        {
          email,
          name: 'Verification Admin User',
          password: 'SecurePassword123!',
        },
        { emailVerified: false }
      );

      const response = await trpcMutate(
        'auth.generateEmailVerificationToken',
        { email },
        { Authorization: `Bearer ${adminAccessToken}` }
      );
      assert.strictEqual(response.status, 200);

      const { data } = (await parseTRPC(response)) as {
        data?: {
          email?: string;
          verificationExpiresAt?: string;
          verificationRequired?: boolean;
          verificationToken?: string;
        };
      };
      assert.ok(data);
      assert.strictEqual(data.email, email);
      assert.strictEqual(data.verificationRequired, true);
      assert.ok(data.verificationToken);
      assert.ok(data.verificationExpiresAt);
    });
  });
});
