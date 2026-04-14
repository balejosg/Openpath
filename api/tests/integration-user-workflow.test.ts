import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  parseTRPC,
  registerAndVerifyIntegrationUser,
  registerIntegrationLifecycle,
  trpcMutate,
  trpcQuery,
} from './integration-test-harness.js';

registerIntegrationLifecycle();

await describe('integration user workflow', async () => {
  await test('completes user registration to login to profile access', async () => {
    const email = `integration-${Date.now().toString()}@test.local`;
    const password = 'IntegrationTest123!';

    const { registerResponse, verifyResponse } = await registerAndVerifyIntegrationUser({
      email,
      password,
      name: 'Integration Test User',
    });

    assert.equal(registerResponse.status, 200, 'Registration should succeed');
    assert.equal(verifyResponse?.status, 200, 'Verification should succeed');

    const loginResponse = await trpcMutate('auth.login', {
      email,
      password,
    });
    assert.equal(loginResponse.status, 200, 'Login should succeed');

    const loginResult = (await parseTRPC(loginResponse)).data as { accessToken?: string };
    assert.ok(loginResult.accessToken, 'Login should return access token');

    const profileResponse = await trpcQuery('auth.me', undefined, {
      Authorization: `Bearer ${loginResult.accessToken}`,
    });
    assert.equal(profileResponse.status, 200, 'Profile access should succeed');

    const profileResult = (await parseTRPC(profileResponse)).data as {
      user?: { email?: string };
    };
    assert.equal(profileResult.user?.email, email);
  });
});
