import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';

import * as authService from '../src/services/auth.service.js';
import * as userStorage from '../src/lib/user-storage.js';
import { closeConnection } from '../src/db/index.js';
import { resetDb, uniqueEmail } from './test-utils.js';

const originalAccessCookieName = process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME;
const DEFAULT_PASSWORD = 'SecurePassword123!';

beforeEach(async () => {
  await resetDb();

  if (originalAccessCookieName === undefined) {
    delete process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME;
  } else {
    process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = originalAccessCookieName;
  }
});

after(async () => {
  if (originalAccessCookieName === undefined) {
    delete process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME;
  } else {
    process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = originalAccessCookieName;
  }

  await closeConnection();
});

void describe('auth service direct coverage', () => {
  void test('blocks login for unverified users with the required verification message', async () => {
    const email = uniqueEmail('auth-service-unverified');
    await userStorage.createUser({
      email,
      name: 'Needs Verification',
      password: DEFAULT_PASSWORD,
    });

    const result = await authService.login(email, DEFAULT_PASSWORD);

    assert.deepStrictEqual(result, {
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: authService.EMAIL_VERIFICATION_REQUIRED_MESSAGE,
      },
    });
  });

  void test('reports cookie session transport when cookie sessions are enabled', async () => {
    process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = 'openpath_access';

    const email = uniqueEmail('auth-service-cookie');
    await userStorage.createUser(
      {
        email,
        name: 'Cookie Session User',
        password: DEFAULT_PASSWORD,
      },
      { emailVerified: true }
    );

    const result = await authService.login(email, DEFAULT_PASSWORD);

    assert.ok(result.ok, 'expected login to succeed for verified user');
    assert.strictEqual(result.data.sessionTransport, 'cookie');
  });
});
