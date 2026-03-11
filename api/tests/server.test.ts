import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import type { AddressInfo } from 'node:net';

import { app } from '../src/server.js';
import * as authLib from '../src/lib/auth.js';
import { closeConnection } from '../src/db/index.js';
import * as userStorage from '../src/lib/user-storage.js';
import { resetDb, uniqueEmail } from './test-utils.js';

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

void describe('server direct coverage', () => {
  void test('accepts the configured access-token cookie on admin setup routes', async () => {
    const server = app.listen(0);
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${String(address.port)}`;
    const email = uniqueEmail('server-admin');

    try {
      const bootstrapResponse = await fetch(`${baseUrl}/api/setup/first-admin`, {
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

      const response = await fetch(`${baseUrl}/api/setup/registration-token`, {
        headers: {
          Cookie: `openpath_access=${encodeURIComponent(accessToken)}`,
        },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { registrationToken?: string };
      assert.ok(typeof body.registrationToken === 'string' && body.registrationToken.length > 0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });
});
