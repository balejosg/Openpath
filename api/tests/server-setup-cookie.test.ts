import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';

import * as authLib from '../src/lib/auth.js';
import { closeConnection } from '../src/db/index.js';
import * as userStorage from '../src/lib/user-storage.js';
import { resetDb, uniqueEmail } from './test-utils.js';
import { startDirectServerHarness } from './server-direct-test-harness.js';

const originalAccessCookieName = process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME;

beforeEach(async () => {
  await resetDb();
  process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = 'openpath_access';
});

after(async () => {
  if (originalAccessCookieName === undefined) {
    delete process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME;
  } else {
    process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = originalAccessCookieName;
  }

  await closeConnection();
});

await describe('server direct coverage - setup cookie auth', async () => {
  await test('accepts the configured access-token cookie on admin setup routes', async () => {
    const harness = startDirectServerHarness();
    const email = uniqueEmail('server-admin');

    try {
      const bootstrapResponse = await fetch(`${harness.baseUrl}/api/setup/first-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: 'Server Admin',
          password: 'SecurePassword123!',
        }),
      });
      assert.strictEqual(bootstrapResponse.status, 200);

      const createdAdmin = await userStorage.getUserByEmail(email);
      assert.ok(createdAdmin, 'expected bootstrap admin to exist');

      const accessToken = authLib.generateTokens(
        {
          id: createdAdmin.id,
          email: createdAdmin.email,
          name: createdAdmin.name,
          passwordHash: 'placeholder',
          createdAt: createdAdmin.createdAt,
          updatedAt: createdAdmin.updatedAt,
          isActive: true,
          emailVerified: true,
        },
        [{ role: 'admin', groupIds: [] }]
      ).accessToken;

      const response = await fetch(`${harness.baseUrl}/api/setup/registration-token`, {
        headers: {
          Cookie: `openpath_access=${encodeURIComponent(accessToken)}`,
        },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { registrationToken?: string };
      assert.ok(typeof body.registrationToken === 'string' && body.registrationToken.length > 0);
    } finally {
      await harness.close();
    }
  });
});
