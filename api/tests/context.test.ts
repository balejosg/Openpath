import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';

import { createContext } from '../src/trpc/context.js';
import * as authLib from '../src/lib/auth.js';
import * as roleStorage from '../src/lib/role-storage.js';
import * as userStorage from '../src/lib/user-storage.js';
import { closeConnection } from '../src/db/index.js';
import { resetDb, uniqueEmail } from './test-utils.js';

const originalAccessCookieName = process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME;

beforeEach(async () => {
  await resetDb();
});

after(async () => {
  if (originalAccessCookieName === undefined) {
    delete process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME;
  } else {
    process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = originalAccessCookieName;
  }

  await closeConnection();
});

void describe('trpc context direct coverage', () => {
  void test('reads the configured auth cookie and re-syncs stale role claims from the database', async () => {
    process.env.OPENPATH_ACCESS_TOKEN_COOKIE_NAME = 'openpath_access';

    const createdUser = await userStorage.createUser(
      {
        email: uniqueEmail('context-user'),
        name: 'Context User',
        password: 'SecurePassword123!',
      },
      { emailVerified: true }
    );

    await roleStorage.assignRole({
      userId: createdUser.id,
      role: 'teacher',
      groupIds: ['group-db'],
      createdBy: 'legacy_admin',
    });

    const accessToken = authLib.generateTokens(
      {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        passwordHash: 'placeholder',
        createdAt: createdUser.createdAt,
        updatedAt: createdUser.updatedAt,
        isActive: true,
        emailVerified: true,
      },
      [{ role: 'teacher', groupIds: ['group-stale'] }]
    ).accessToken;

    const contextOptions: CreateExpressContextOptions = {
      req: {
        headers: {
          cookie: `theme=light; openpath_access=${encodeURIComponent(accessToken)}`,
        },
      } as never,
      res: {} as never,
      info: {
        accept: null,
        type: 'query',
        isBatchCall: false,
        calls: [],
        connectionParams: null,
        signal: new AbortController().signal,
        url: null,
      },
    };

    const context = await createContext(contextOptions);

    assert.ok(context.user);
    assert.deepStrictEqual(context.user.roles, [{ role: 'teacher', groupIds: ['group-db'] }]);
  });
});
