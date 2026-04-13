import { describe, test } from 'node:test';
import assert from 'node:assert';

import { sql } from 'drizzle-orm';

import * as authLib from '../src/lib/auth.js';
import * as roleStorage from '../src/lib/role-storage.js';
import * as userStorage from '../src/lib/user-storage.js';
import * as authService from '../src/services/auth.service.js';
import {
  DEFAULT_PASSWORD,
  db,
  expectOk,
  registerServiceCoverageLifecycle,
  type ServiceResult,
  type TestUser,
  setGoogleClientId,
  setUserActive,
  stubGoogleError,
  stubGooglePayload,
  uniqueEmail,
} from './service-coverage-test-support.js';

registerServiceCoverageLifecycle();

interface AuthRegisterData {
  user: TestUser;
  verificationToken: string;
}

interface AuthLoginData {
  accessToken: string;
  refreshToken: string;
  user: TestUser;
}

interface AuthProfileData {
  user: TestUser;
}

interface TokenData {
  token: string;
}

void describe('Coverage-oriented service tests - authService', { concurrency: false }, () => {
  void test('registers users, verifies email, refreshes tokens, and returns profiles', async () => {
    const email = uniqueEmail('auth-flow');
    const registerResult = (await authService.register({
      email,
      name: 'Auth Flow User',
      password: DEFAULT_PASSWORD,
    })) as ServiceResult<AuthRegisterData>;
    const registerData = expectOk(registerResult, 'Expected authService.register to succeed');
    assert.strictEqual(registerData.user.emailVerified, false);
    assert.ok(registerData.verificationToken);

    const blockedLogin = await authService.login(email, DEFAULT_PASSWORD);
    assert.deepStrictEqual(blockedLogin, {
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: authService.EMAIL_VERIFICATION_REQUIRED_MESSAGE,
      },
    });

    const missingProfile = await authService.getProfile('missing-user-id');
    assert.deepStrictEqual(missingProfile, {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });

    const missingVerify = await authService.verifyEmail(
      uniqueEmail('auth-missing'),
      'missing-token'
    );
    assert.deepStrictEqual(missingVerify, {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });

    const invalidVerify = await authService.verifyEmail(email, 'wrong-token');
    assert.deepStrictEqual(invalidVerify, {
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Invalid or expired verification token' },
    });

    const verified = await authService.verifyEmail(email, registerData.verificationToken);
    assert.deepStrictEqual(verified, { ok: true, data: { success: true } });

    const alreadyVerified = await authService.verifyEmail(email, registerData.verificationToken);
    assert.deepStrictEqual(alreadyVerified, { ok: true, data: { success: true } });

    const loginResult = (await authService.login(
      email,
      DEFAULT_PASSWORD
    )) as ServiceResult<AuthLoginData>;
    const loginData = expectOk(
      loginResult,
      'Expected authService.login to succeed after verification'
    );

    const refreshResult = await authService.refresh(loginData.refreshToken);
    assert.ok(refreshResult.ok);

    const userProfile = (await authService.getProfile(
      loginData.user.id
    )) as ServiceResult<AuthProfileData>;
    const userProfileData = expectOk(userProfile, 'Expected profile lookup to succeed');
    assert.strictEqual(userProfileData.user.emailVerified, true);

    const resendResult = await authService.generateEmailVerificationToken(email);
    assert.deepStrictEqual(resendResult, {
      ok: false,
      error: { code: 'CONFLICT', message: 'Email is already verified' },
    });
  });

  void test('handles reset-password and change-password edge cases', async () => {
    const email = uniqueEmail('auth-passwords');
    const created = (await userStorage.createUser(
      {
        email,
        name: 'Password User',
        password: DEFAULT_PASSWORD,
      },
      { emailVerified: true }
    )) as TestUser;

    const missingResetToken = await authService.generateResetToken(
      uniqueEmail('auth-missing-reset')
    );
    assert.deepStrictEqual(missingResetToken, {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });

    const resetToken = (await authService.generateResetToken(email)) as ServiceResult<TokenData>;
    const resetTokenData = expectOk(resetToken, 'Expected reset token generation to succeed');

    const invalidReset = await authService.resetPassword(
      email,
      'wrong-reset-token',
      'NextPassword123!'
    );
    assert.deepStrictEqual(invalidReset, {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });

    const validReset = await authService.resetPassword(
      email,
      resetTokenData.token,
      'NextPassword123!'
    );
    assert.deepStrictEqual(validReset, { ok: true, data: { success: true } });

    const missingPasswordInput = await authService.changePassword(
      created.id,
      '',
      'AnotherPass123!'
    );
    assert.deepStrictEqual(missingPasswordInput, {
      ok: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Current and new password are required',
      },
    });

    const shortPassword = await authService.changePassword(created.id, 'NextPassword123!', 'short');
    assert.deepStrictEqual(shortPassword, {
      ok: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'New password must be at least 8 characters',
      },
    });

    const missingUser = await authService.changePassword(
      'missing-user-id',
      'NextPassword123!',
      'AnotherPass123!'
    );
    assert.deepStrictEqual(missingUser, {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });

    const wrongCurrentPassword = await authService.changePassword(
      created.id,
      'WrongPassword123!',
      'AnotherPass123!'
    );
    assert.deepStrictEqual(wrongCurrentPassword, {
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Current password is incorrect' },
    });

    const validChange = await authService.changePassword(
      created.id,
      'NextPassword123!',
      'AnotherPass123!'
    );
    assert.deepStrictEqual(validChange, { ok: true, data: { success: true } });

    const loginWithChangedPassword = (await authService.login(
      email,
      'AnotherPass123!'
    )) as ServiceResult<AuthLoginData>;
    assert.ok(loginWithChangedPassword.ok);
  });

  void test('returns unauthorized when password persistence fails unexpectedly', async () => {
    const email = uniqueEmail('auth-password-trigger');
    const created = (await userStorage.createUser(
      {
        email,
        name: 'Trigger Password User',
        password: DEFAULT_PASSWORD,
      },
      { emailVerified: true }
    )) as TestUser;

    const triggerName = `change_password_fail_${String(Date.now())}`;
    const functionName = `${triggerName}_fn`;

    try {
      await db.execute(
        sql.raw(`
            CREATE OR REPLACE FUNCTION ${functionName}()
            RETURNS trigger AS $$
            BEGIN
              IF NEW.id = '${created.id}' THEN
                RAISE EXCEPTION 'forced password update failure';
              END IF;
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
          `)
      );
      await db.execute(
        sql.raw(`
            CREATE TRIGGER ${triggerName}
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION ${functionName}();
          `)
      );

      const result = await authService.changePassword(
        created.id,
        DEFAULT_PASSWORD,
        'AnotherPass123!'
      );
      assert.equal(result.ok, false);
      if (result.ok) {
        throw new Error('Expected password change failure');
      }
      assert.deepStrictEqual(result.error.code, 'UNAUTHORIZED');
      assert.match(result.error.message, /^Failed query: update "users" set "password_hash"/);
    } finally {
      await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON users;`));
      await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${functionName}();`));
    }
  });

  void test('generates verification tokens for unverified users and blocks refresh until verified', async () => {
    const missingEmail = await authService.generateEmailVerificationToken(
      uniqueEmail('auth-missing')
    );
    assert.deepStrictEqual(missingEmail, {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });

    const email = uniqueEmail('auth-refresh-block');
    await userStorage.createUser({
      email,
      name: 'Refresh Block User',
      password: DEFAULT_PASSWORD,
    });

    const verificationToken = await authService.generateEmailVerificationToken(email);
    assert.ok(verificationToken.ok);

    const fullUser = (await userStorage.getUserByEmail(email)) as TestUser | null;
    assert.ok(fullUser);

    const tokens = authLib.generateTokens(fullUser, []);
    const refreshResult = await authService.refresh(tokens.refreshToken);
    assert.deepStrictEqual(refreshResult, {
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: authService.EMAIL_VERIFICATION_REQUIRED_MESSAGE,
      },
    });
  });

  void test('covers Google login branches for config, payload, linking, unknown accounts, inactivity, and timeouts', async () => {
    const missingConfig = await authService.loginWithGoogle('token-without-config');
    assert.deepStrictEqual(missingConfig, {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Google OAuth not configured' },
    });

    setGoogleClientId('test-google-client-id');

    stubGooglePayload({ sub: 'missing-email-sub' });
    const invalidPayload = await authService.loginWithGoogle('invalid-payload-token');
    assert.deepStrictEqual(invalidPayload, {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid Google token' },
    });

    const existingEmail = uniqueEmail('google-link-existing');
    const existingUser = (await userStorage.createUser({
      email: existingEmail,
      name: 'Existing Google User',
      password: DEFAULT_PASSWORD,
    })) as TestUser;
    await roleStorage.assignRole({
      userId: existingUser.id,
      role: 'teacher',
      groupIds: ['google-linked-group'],
      createdBy: existingUser.id,
    });
    stubGooglePayload({
      email: existingEmail,
      sub: 'google-link-sub',
      name: 'Existing Google User',
    });
    const linkedLogin = (await authService.loginWithGoogle(
      'link-existing-user-token'
    )) as ServiceResult<AuthLoginData>;
    const linkedLoginData = expectOk(
      linkedLogin,
      'Expected Google login to succeed for existing user'
    );
    assert.ok(linkedLoginData.user.roles);
    assert.strictEqual(linkedLoginData.user.roles[0]?.role, 'teacher');

    const linkedUser = (await userStorage.getUserByGoogleId('google-link-sub')) as TestUser | null;
    assert.ok(linkedUser);
    assert.strictEqual(linkedUser.id, existingUser.id);
    assert.strictEqual(linkedUser.emailVerified, true);

    const unknownEmail = uniqueEmail('google-create-new');
    stubGooglePayload({
      email: unknownEmail,
      sub: 'google-create-sub',
      name: 'Unknown Google User',
    });
    const unknownAccountLogin = await authService.loginWithGoogle('create-new-user-token');
    assert.deepStrictEqual(unknownAccountLogin, {
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Google sign-in is only available for existing or preapproved accounts',
      },
    });
    assert.strictEqual(await userStorage.getUserByGoogleId('google-create-sub'), null);

    await setUserActive(existingUser.id, false);
    stubGooglePayload({
      email: existingEmail,
      sub: 'google-link-sub',
      name: 'Existing Google User',
    });
    const inactiveLogin = await authService.loginWithGoogle('inactive-google-user-token');
    assert.deepStrictEqual(inactiveLogin, {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Account inactive' },
    });

    stubGoogleError('Google token verification timed out after 15000ms');
    const timeoutLogin = await authService.loginWithGoogle('timeout-google-token');
    assert.deepStrictEqual(timeoutLogin, {
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Google verification timed out. Please try again.',
      },
    });

    stubGoogleError('Google verification exploded');
    const genericFailure = await authService.loginWithGoogle('generic-google-token');
    assert.deepStrictEqual(genericFailure, {
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Google authentication failed',
      },
    });
  });

  void test('returns unauthorized when Google linking cannot reload the existing user', async () => {
    setGoogleClientId('test-google-client-id');

    const disappearingGoogleId = 'google-disappearing-sub';
    const triggerName = `google_disappear_${String(Date.now())}`;
    const functionName = `${triggerName}_fn`;
    const existingEmail = uniqueEmail('google-disappearing');
    const existingUser = (await userStorage.createUser({
      email: existingEmail,
      name: 'Google Disappearing User',
      password: DEFAULT_PASSWORD,
    })) as TestUser;

    try {
      await db.execute(
        sql.raw(`
            CREATE OR REPLACE FUNCTION ${functionName}()
            RETURNS trigger AS $$
            BEGIN
              IF NEW.google_id = '${disappearingGoogleId}' THEN
                DELETE FROM users WHERE id = NEW.id;
              END IF;
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
          `)
      );
      await db.execute(
        sql.raw(`
            CREATE TRIGGER ${triggerName}
            AFTER UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION ${functionName}();
          `)
      );

      stubGooglePayload({
        email: existingEmail,
        sub: disappearingGoogleId,
        name: 'Google Disappearing User',
      });

      const result = await authService.loginWithGoogle('disappearing-google-token');
      assert.deepStrictEqual(result, {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Failed to create or find user',
        },
      });
      const reloadedUser = (await userStorage.getUserById(existingUser.id)) as TestUser | null;
      assert.strictEqual(reloadedUser, null);
    } finally {
      await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON users;`));
      await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${functionName}();`));
    }
  });
});
