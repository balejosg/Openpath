import { describe, test } from 'node:test';
import assert from 'node:assert';

import {
  type AuthResult,
  type StoredUser,
  parseTRPC,
  registerAuthHttpLifecycle,
  stubGooglePayload,
  trpcMutate,
  uniqueAuthEmail,
  userStorage,
} from './auth-test-harness.js';

registerAuthHttpLifecycle();

void describe('Authentication API tests - Google login', async () => {
  await describe('tRPC auth.googleLogin - Existing users only', async () => {
    await test('should link Google login to an existing account instead of provisioning a new one', async () => {
      const email = uniqueAuthEmail('google-existing');
      const googleId = `google-existing-${Date.now().toString()}`;
      await userStorage.createUser(
        {
          email,
          name: 'Existing Google User',
          password: 'SecurePassword123!',
        },
        { emailVerified: false }
      );

      stubGooglePayload({ email, name: 'Existing Google User', sub: googleId });

      const response = await trpcMutate('auth.googleLogin', { idToken: 'fake-google-token' });
      assert.strictEqual(response.status, 200);

      const { data } = (await parseTRPC(response)) as { data?: AuthResult };
      assert.strictEqual(data?.user?.email, email);

      const storedUser = (await userStorage.getUserByEmail(email)) as StoredUser | null;
      assert.ok(storedUser);
      assert.strictEqual(storedUser.googleId, googleId);
      assert.strictEqual(storedUser.emailVerified, true);
    });

    await test('should reject unknown Google accounts instead of auto-provisioning them', async () => {
      const email = uniqueAuthEmail('google-unknown');
      stubGooglePayload({
        email,
        name: 'Unknown Google User',
        sub: `google-unknown-${Date.now().toString()}`,
      });

      const response = await trpcMutate('auth.googleLogin', { idToken: 'fake-google-token' });
      assert.strictEqual(response.status, 403);

      const { error } = await parseTRPC(response);
      assert.match(error ?? '', /existing|preapproved/i);

      const storedUser = (await userStorage.getUserByEmail(email)) as StoredUser | null;
      assert.strictEqual(storedUser, null);
    });
  });
});
